import io, { Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

export interface CallEvent {
  callId: string;
  callerId?: string;
  calleeId?: string;
  callerName?: string;
}

export interface IceCandidate {
  candidate: string;
  sdpMLineIndex?: number;
  sdpMid?: string;
}

export interface PresenceUpdate {
  userId: string;
  username: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen?: number;
}

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  connect(token: string) {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    this.setupDefaultListeners();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  private setupDefaultListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.emit('connected');
    });

    this.socket.on('disconnect', () => {
      this.emit('disconnected');
    });

    this.socket.on('connect_error', (error) => {
      this.emit('error', error);
    });
  }

  // Event management
  on(event: string, callback: (...args: any[]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  emit(event: string, data?: any) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  // Call events
  initiateCall(calleeId: string) {
    this.emit('call-request', { calleeId });
  }

  acceptCall(callId: string) {
    this.emit('call-accept', { callId });
  }

  rejectCall(callId: string, reason?: string) {
    this.emit('call-reject', { callId, reason });
  }

  endCall(callId: string) {
    this.emit('call-hangup', { callId });
  }

  // WebRTC signaling
  sendOffer(callId: string, offer: RTCSessionDescriptionInit) {
    this.emit('webrtc-offer', { callId, offer });
  }

  sendAnswer(callId: string, answer: RTCSessionDescriptionInit) {
    this.emit('webrtc-answer', { callId, answer });
  }

  sendIceCandidate(callId: string, candidate: IceCandidate) {
    this.emit('webrtc-ice-candidate', { callId, candidate });
  }

  // Media controls
  toggleMic(callId: string, enabled: boolean) {
    this.emit('mic-toggled', { callId, enabled });
  }

  toggleCamera(callId: string, enabled: boolean) {
    this.emit('camera-toggled', { callId, enabled });
  }

  // Presence
  setStatus(status: 'online' | 'away' | 'busy' | 'offline') {
    this.emit('set-status', { status });
  }

  getOnlineFriends() {
    this.emit('get-online-friends');
  }

  // Heartbeat
  sendHeartbeat() {
    this.emit('heartbeat');
  }
}

export const socketService = new SocketService();
