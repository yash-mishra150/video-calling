"use client";

import { FC, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Phone, Clock } from 'lucide-react';
import { socketService } from '@/lib/socket';

interface CallPageProps {
  callId: string;
  username: string;
  isCaller?: boolean;
  onCallEnd: () => void;
}

const CallPage: FC<CallPageProps> = ({ callId, username, isCaller = true, onCallEnd }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidateBufferRef = useRef<any[]>([]);
  const listenerRefsRef = useRef<{ [key: string]: Function }>({});
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    startWebRTC();
    return () => {
      Object.entries(listenerRefsRef.current).forEach(([eventName, handler]) => {
        socketService.off(eventName, handler as any);
      });
      listenerRefsRef.current = {};
      
      cleanupWebRTC();
    };
  }, [callId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const flushIceCandidates = async (pc: RTCPeerConnection) => {
    console.log(`🧊 Flushing ${iceCandidateBufferRef.current.length} buffered ICE candidates`);
    const buffer = iceCandidateBufferRef.current;
    iceCandidateBufferRef.current = [];

    for (const candidate of buffer) {
      try {
        // Check if peer connection is still open before adding candidate
        if (pc.signalingState !== 'closed') {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('Error adding buffered ICE candidate:', err);
      }
    }
  };

  const startWebRTC = async () => {
    try {
      // ICE configuration with STUN and TURN servers
      const iceConfiguration = {
        iceServers: [
          { urls: ['stun:stun.l.google.com:19302'] },
          { urls: ['stun:stun1.l.google.com:19302'] },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      };

      // Create RTCPeerConnection
      const pc = new RTCPeerConnection(iceConfiguration);

      peerConnectionRef.current = pc;

      // Get local media
      console.log('🎤 Requesting camera and microphone...');
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      console.log('Camera and microphone granted');

      // Check if peer connection is still valid before adding tracks
      if (pc.signalingState === 'closed') {
        console.log('Peer connection already closed, stopping media');
        localStream.getTracks().forEach(track => track.stop());
        return;
      }

      // Store local stream in ref
      localStreamRef.current = localStream;

      // Add tracks
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });

      // Display local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('📹 Received remote stream');
        console.log('📹 Remote track type:', event.track.kind);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketService.sendIceCandidate(callId, {
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex ?? undefined,
            sdpMid: event.candidate.sdpMid ?? undefined
          });
        }
      };

      // Listen for ICE candidates
      const iceCandidateHandler = async ({ candidate }: any) => {
        if (pc && candidate) {
          // Check if peer connection is still open
          if (pc.signalingState === 'closed') {
            console.log('Ignoring ICE candidate - peer connection is closed');
            return;
          }

          // If remote description is set, add candidate immediately
          if (pc.remoteDescription) {
            pc.addIceCandidate(new RTCIceCandidate(candidate))
              .catch(err => console.error('ICE candidate error:', err));
          } else {
            // Buffer the candidate until remote description is set
            console.log('🧊 Buffering ICE candidate (remote description not set yet)');
            iceCandidateBufferRef.current.push(candidate);
          }
        }
      };
      
      // Remove old listener if it exists
      if (listenerRefsRef.current['webrtc-ice-candidate']) {
        socketService.off('webrtc-ice-candidate', listenerRefsRef.current['webrtc-ice-candidate'] as any);
      }
      
      socketService.on('webrtc-ice-candidate', iceCandidateHandler);
      listenerRefsRef.current['webrtc-ice-candidate'] = iceCandidateHandler;

      // Offer/Answer - Set up ALL listeners first
      if (isCaller) {
        // CALLER: Set up answer listener FIRST
        const answerHandler = async ({ answer }: any) => {
          console.log('📥 Received answer');
          if (pc) {
            try {
              // Check if connection is still open before setting remote description
              if (pc.signalingState === 'closed') {
                console.log('Cannot set remote description - peer connection is closed');
                return;
              }

              await pc.setRemoteDescription(new RTCSessionDescription(answer));
              console.log('Connection established');
              // Flush any buffered ICE candidates
              await flushIceCandidates(pc);
            } catch (err) {
              console.error('Error setting answer:', err);
            }
          }
        };

        // Remove old listener if it exists
        if (listenerRefsRef.current['webrtc-answer']) {
          socketService.off('webrtc-answer', listenerRefsRef.current['webrtc-answer'] as any);
        }

        socketService.on('webrtc-answer', answerHandler);
        listenerRefsRef.current['webrtc-answer'] = answerHandler;

        // Then create and send offer
        console.log('📤 Creating and sending offer...');
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });

        await pc.setLocalDescription(new RTCSessionDescription(offer));
        socketService.sendOffer(callId, offer);
        console.log('Offer sent');
      } else {
        // CALLEE: Set up offer listener
        const offerHandler = async ({ offer }: any) => {
          console.log('📥 Received offer');

          if (pc) {
            try {
              // Check if connection is still open before setting remote description
              if (pc.signalingState === 'closed') {
                console.log('Cannot set remote description - peer connection is closed');
                return;
              }

              await pc.setRemoteDescription(new RTCSessionDescription(offer));
              // Flush any buffered ICE candidates
              await flushIceCandidates(pc);

              console.log('📤 Creating and sending answer...');
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(new RTCSessionDescription(answer));

              socketService.sendAnswer(callId, answer);
              console.log('Answer sent');
            } catch (err) {
              console.error('Answer error:', err);
            }
          }
        };

        // Remove old listener if it exists
        if (listenerRefsRef.current['webrtc-offer']) {
          socketService.off('webrtc-offer', listenerRefsRef.current['webrtc-offer'] as any);
        }

        socketService.on('webrtc-offer', offerHandler);
        listenerRefsRef.current['webrtc-offer'] = offerHandler;
      }

      // Connection states
      pc.onconnectionstatechange = () => {
        console.log('🔗 Connection state:', pc.connectionState);

        switch (pc.connectionState) {
          case 'connected':
            console.log('Peer connection established');
            break;
          case 'failed':
            console.log('Peer connection failed');
            break;
          case 'disconnected':
          case 'closed':
            console.log('Peer connection ended');
            cleanupWebRTC();
            onCallEnd();
            break;
        }
      };

    } catch (error) {
      console.error('WebRTC error:', error);
      cleanupWebRTC();
      onCallEnd();
    }
  };

  const cleanupWebRTC = () => {
    console.log('🧹 Cleaning up WebRTC...');
    
    // Close peer connection first
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop all local tracks using the ref
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`🛑 Stopped ${track.kind} track`);
      });
      localStreamRef.current = null;
    }

    // Clear video sources
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    // Clear remote video
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getAudioTracks();
      tracks.forEach(track => {
        track.enabled = !isMicOn;
      });
      setIsMicOn(!isMicOn);
      socketService.toggleMic(callId, !isMicOn);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getVideoTracks();
      tracks.forEach(track => {
        track.enabled = !isVideoOn;
      });
      setIsVideoOn(!isVideoOn);
      socketService.toggleCamera(callId, !isVideoOn);
    }
  };

  const endCall = () => {
    console.log('Hanging up...');
    socketService.endCall(callId);
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    cleanupWebRTC();
    onCallEnd();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col overflow-hidden">
      {/* Videos */}
      <div className="flex-1 relative min-h-0">
        {/* Remote video (background) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-contain bg-black"
        />

        {/* Local video (PIP) */}
        <div className="absolute bottom-20 right-6 w-48 h-36 bg-gray-900 rounded-lg overflow-hidden border-2 border-white shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>

        {/* Duration */}
        <div className="absolute top-6 left-6 bg-black/60 text-white px-4 py-2 rounded-full text-lg font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5" />
          {formatDuration(callDuration)}
        </div>

        {/* Username */}
        <div className="absolute top-6 right-6 bg-black/60 text-white px-4 py-2 rounded-full">
          <p className="text-sm">{username}</p>
        </div>
      </div>

      {/* Controls - Fixed at bottom */}
      <div className="shrink-0 bg-black/90 backdrop-blur-sm px-6 py-4 flex items-center justify-center gap-6">
        <button
          onClick={toggleMic}
          className={`p-4 rounded-full transition-all ${
            isMicOn
              ? 'bg-gray-700 hover:bg-gray-600'
              : 'bg-red-600 hover:bg-red-700'
          } text-white`}
        >
          {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
        </button>

        <button
          onClick={toggleVideo}
          className={`p-4 rounded-full transition-all ${
            isVideoOn
              ? 'bg-gray-700 hover:bg-gray-600'
              : 'bg-red-600 hover:bg-red-700'
          } text-white`}
        >
          {isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
        </button>

        <button
          onClick={endCall}
          className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all"
        >
          <Phone className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default CallPage;
