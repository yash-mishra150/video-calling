/**
 * QUICK START GUIDE - WebRTC Video Calling Backend
 */

// =============================================================================
// 1. CLIENT-SIDE CONNECTION (Browser/React/Vue/Angular)
// =============================================================================

// Connect to server with JWT token
const socket = io('http://localhost:4000', {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // From login endpoint
  }
});

// Handle connection events
socket.on('connect', () => console.log('Connected to signaling server'));
socket.on('disconnect', () => console.log('Disconnected'));
socket.on('connect_error', (error) => console.log('Auth error:', error.message));

// =============================================================================
// 2. GET ONLINE USERS
// =============================================================================

socket.emit('get-online-users');
socket.on('online-users', ({ users }) => {
  console.log('Online users:', users); // [userId1, userId2, ...]
});

// Listen for presence updates
socket.on('user-online', ({ userId }) => console.log(userId, 'came online'));
socket.on('user-offline', ({ userId }) => console.log(userId, 'went offline'));

// =============================================================================
// 3. INITIATE CALL
// =============================================================================

const calleeId = 'user-2-id';
socket.emit('call-request', { calleeId });

// Listen for response
socket.on('call-initiated', ({ callId }) => {
  console.log('Calling...', callId);
  // Store callId for later
});

socket.on('call-accepted', ({ callId, calleeId }) => {
  console.log('Call accepted! Start WebRTC signaling');
  initiateWebRTC(callId, calleeId);
});

socket.on('call-rejected', ({ callId, reason }) => {
  console.log('Call rejected:', reason);
});

socket.on('call-cancelled', ({ callId }) => {
  console.log('Caller cancelled the call');
});

// =============================================================================
// 4. RECEIVE INCOMING CALL
// =============================================================================

socket.on('incoming-call', ({ callId, callerId, callerName }) => {
  console.log(`Incoming call from ${callerName}`);
  
  // User must accept or reject
  userAcceptsCall ? 
    socket.emit('call-accept', { callId }) :
    socket.emit('call-reject', { callId });
});

socket.on('call-accepted', ({ callId, callerId }) => {
  console.log('You accepted! Start WebRTC signaling');
  initiateWebRTC(callId, callerId);
});

// =============================================================================
// 5. WEBRTC SIGNALING (Offer from Caller)
// =============================================================================

async function initiateWebRTC(callId, remotePeerId) {
  // Create peer connection
  const peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302'] }
    ]
  });

  // Add local tracks (audio/video)
  const localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: { width: 1280, height: 720 }
  });

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // Handle remote track
  peerConnection.ontrack = (event) => {
    const remoteStream = event.streams[0];
    // Display remote video
    document.getElementById('remote-video').srcObject = remoteStream;
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('webrtc-ice-candidate', {
        callId,
        candidate: event.candidate
      });
    }
  };

  // Caller sends offer
  if (amCaller) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    socket.emit('webrtc-offer', { callId, offer });
  }
  
  // Callee sends answer
  socket.on('webrtc-offer', async ({ offer }) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    socket.emit('webrtc-answer', { callId, answer });
  });

  // Both receive answer
  socket.on('webrtc-answer', async ({ answer }) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  });

  // Both receive ICE candidates
  socket.on('webrtc-ice-candidate', ({ candidate }) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  });

  return peerConnection;
}

// =============================================================================
// 6. END CALL
// =============================================================================

socket.emit('call-hangup', { callId });

socket.on('call-ended', ({ callId, reason }) => {
  console.log('Call ended:', reason);
  // Close peer connection, stop media tracks
  peerConnection.close();
});

// =============================================================================
// 7. ERROR HANDLING
// =============================================================================

socket.on('call-error', ({ message }) => {
  console.error('Call error:', message);
  // Handle: "User is offline", "Already in call", etc.
});

socket.on('webrtc-error', ({ message }) => {
  console.error('WebRTC error:', message);
  // Handle: "Call not accepted", "Only caller sends offer", etc.
});

// =============================================================================
// 8. AUTHENTICATION (REST API - via Fetch or Axios)
// =============================================================================

// Register
const registerResponse = await fetch('http://localhost:4000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'john_doe',
    password: 'secure123'
  })
});

// Login
const loginResponse = await fetch('http://localhost:4000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'john_doe',
    password: 'secure123'
  })
});

const { token, userId, username } = await loginResponse.json();
// Use token for Socket.IO connection (see step 1)

// =============================================================================
// 9. OTHER REST ENDPOINTS
// =============================================================================

// Search users
const searchResponse = await fetch('http://localhost:4000/api/users/search?q=jane', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const users = await searchResponse.json();

// Add contact
await fetch('http://localhost:4000/api/contacts/add', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ contactId: userId2 })
});

// Health check
await fetch('http://localhost:4000/health'); // { status: 'ok' }
