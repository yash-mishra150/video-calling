# 1-to-1 Video Calling Backend (MVP)

A production-ready WebRTC signaling backend for peer-to-peer video calling using Node.js, Express, Socket.IO, and MongoDB.

## Architecture Overview

```
┌─────────────────┐
│   Web Client    │
│  (Browser)      │
└────────┬────────┘
         │
         │ WebSocket (Socket.IO)
         │ & HTTP (REST)
         │
    ┌────▼────────────────────────┐
    │  CONTROL PLANE (Signaling)   │
    ├──────────────────────────────┤
    │ • User authentication (JWT)  │
    │ • Presence tracking          │
    │ • Call intent (request/accept)│
    │ • WebRTC offer/answer relay  │
    │ • ICE candidate relay        │
    └────────────┬─────────────────┘
                 │
         ┌───────┴────────┐
         │                │
    ┌────▼────┐    ┌─────▼──────┐
    │ Caller   │    │   Callee   │
    │ (Client) │    │  (Client)  │
    └────┬─────┘    └─────┬──────┘
         │                │
         │ P2P Media      │
         │ (Audio/Video)  │
         └────────┬───────┘
                  │
            (Direct Peer-to-Peer)
```

## System Flow

### 1. User Authentication (REST)
```
POST /api/auth/register  → User creates account
POST /api/auth/login     → User receives JWT token
```

### 2. WebSocket Connection
```
Client connects with JWT token in handshake auth
→ Backend authenticates and registers user session
→ Broadcasts "user-online" to all connected clients
```

### 3. Call Initiation
```
Caller sends:   call-request → Callee
Backend checks: Callee is online AND both are idle
If YES:
  - Create call record (pending)
  - Send "incoming-call" to Callee
  - Send "call-initiated" to Caller
If NO:
  - Send error "User is offline" or "Already in call"
```

### 4. Call Accept (Only Option)
```
Callee receives "incoming-call"
  ↓
Callee sends: call-accept
  ↓
Backend updates call status to "accepted"
Both parties now idle → in-call
  ↓
Send "call-accepted" to both parties
→ WebRTC signaling can now start
```

### 5. WebRTC Signaling (Media Plane Setup)
```
Caller sends:   webrtc-offer (SDP) → Backend → Callee
Callee sends:   webrtc-answer (SDP) → Backend → Caller
Both send:      webrtc-ice-candidate (multiple) → Backend → Other party

Backend only RELAYS. No media passes through server.
```

### 6. Call Termination
```
Either party sends: call-hangup
  ↓
Backend notifies other party
  ↓
Both statuses reset to "idle"
  ↓
WebRTC connection closes (direct between peers)
```

### 7. Disconnect Cleanup
```
Client disconnects (network failure, tab close, etc.)
  ↓
Backend finds all active calls for this user
  ↓
Notifies other party: "call-ended (Other party disconnected)"
  ↓
Resets both statuses to idle
  ↓
Broadcasts "user-offline"
```

## Control Plane vs Media Plane

| Aspect | Control Plane | Media Plane |
|--------|---------------|------------|
| **Protocol** | WebSocket (Socket.IO) | UDP (WebRTC) |
| **Path** | Via Server | Direct P2P |
| **Data** | Signaling (offers, answers, ICE) | Audio/Video streams |
| **Server Role** | Active relay | No involvement |
| **Bandwidth** | Minimal (few KB) | Heavy (1-5 Mbps) |
| **Latency** | ~100ms acceptable | <50ms preferred |

## Why Calls Fail if User is Offline

1. **Presence Check**: Backend maintains in-memory `userSessions` map
2. **On Connect**: User added to map
3. **On Call Request**: Backend checks if callee exists in map
4. **If Offline**: User not in map → return error "User is offline"
5. **On Disconnect**: User removed from map → immediate availability update

This prevents "zombie" calls where caller waits indefinitely for offline user.

## API & Socket Events

### REST APIs

#### Authentication
```javascript
POST /api/auth/register
Body: { username, password }
Response: { message: "Registered" }

POST /api/auth/login
Body: { username, password }
Response: { token, userId, username }
```

#### User Search
```javascript
GET /api/users/search?q=john
Headers: Authorization: Bearer <token>
Response: [{ _id, username }, ...]
```

#### Contact Management
```javascript
POST /api/contacts/add
Headers: Authorization: Bearer <token>
Body: { contactId }
Response: { message: "Contact added" }
```

### Socket.IO Events

#### Presence
```javascript
// Client → Server
socket.emit('get-online-users')
socket.on('online-users', { users: [userId1, userId2, ...] })

// Server → Clients
socket.on('user-online', { userId, status: 'online' })
socket.on('user-offline', { userId, status: 'offline' })
```

#### Call Flow
```javascript
// Caller → Server
socket.emit('call-request', { calleeId })

// Server → Callee
socket.on('incoming-call', { callId, callerId, callerName })

// Callee → Server
socket.emit('call-accept', { callId })
socket.emit('call-reject', { callId })

// Server → Both
socket.on('call-accepted', { callId, callerId/calleeId })
socket.on('call-rejected', { callId, reason })

// Either → Server
socket.emit('call-hangup', { callId })

// Server → Other
socket.on('call-ended', { callId, reason })
```

#### WebRTC Signaling
```javascript
// Caller → Server → Callee
socket.emit('webrtc-offer', { callId, offer })
socket.on('webrtc-offer', { callId, offer })

// Callee → Server → Caller
socket.emit('webrtc-answer', { callId, answer })
socket.on('webrtc-answer', { callId, answer })

// Both directions
socket.emit('webrtc-ice-candidate', { callId, candidate })
socket.on('webrtc-ice-candidate', { callId, candidate })
```

## State Management

### In-Memory Data Structures

```javascript
// User Sessions (expires on disconnect)
userSessions: Map<userId, {
  socketId,
  status: 'idle' | 'calling' | 'in-call',
  connectedAt
}>

// Active Calls (expires on hangup/disconnect)
activeCalls: Map<callId, {
  callId,
  caller: userId,
  callee: userId,
  status: 'pending' | 'accepted' | 'active',
  createdAt
}>
```

### Status Transitions

```
IDLE
  ↓ (call-request accepted by callee)
CALLING → IN-CALL
  ↓ (call-hangup or disconnect)
IDLE
```

## Security Features

### 1. JWT Authentication
- All requests require valid JWT token
- Token verified on WebSocket connection
- Token verified on protected REST routes

### 2. Security Headers (Helmet)
- Prevents MIME sniffing
- Disables caching for sensitive data
- Sets X-Frame-Options, X-Content-Type-Options, etc.

### 3. Rate Limiting
- Auth routes limited to 5 requests per IP per 15 minutes
- Prevents brute-force attacks

### 4. Input Validation
- Username: min 3 chars, lowercase
- Password: min 6 chars
- Search queries: string validation
- Contact IDs: object ID validation

### 5. Call Authorization
- Only call participants can relay WebRTC data
- Prevents eavesdropping or message injection
- Caller sends offer, callee sends answer only

## Middleware Stack

```
Request Flow:
  ↓
[Helmet] - Security headers
  ↓
[CORS] - Cross-origin requests
  ↓
[Logging] - Request logging (method, route, status, time)
  ↓
[Rate Limiter] - Auth route protection
  ↓
[Body Parser] - JSON parsing
  ↓
[Validation] - Input sanitization
  ↓
[JWT Auth] - Protected routes only
  ↓
[Route Handler]
```

## Setup & Run

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)
- npm/yarn

### Installation
```bash
npm install
```

### Environment Variables (.env)
```
MONGODB_URI=mongodb://localhost:27017/video-call
JWT_SECRET=your-secret-key-here
PORT=4000
```

### Start Development Server
```bash
npm run dev
```

Server runs on `http://localhost:4000`

### Client Connection
```javascript
// Example client code
import io from 'socket.io-client';

const socket = io('http://localhost:4000', {
  auth: {
    token: 'jwt-token-from-login'
  }
});

socket.on('connect', () => console.log('Connected'));
socket.on('user-online', (data) => console.log('User online:', data));
```

## Production Checklist

- [ ] Use environment variables for sensitive config
- [ ] Enable HTTPS (required for WebRTC)
- [ ] Setup MongoDB replica set for horizontal scaling
- [ ] Implement TURN servers for NAT traversal
- [ ] Add call history to database
- [ ] Implement call recording
- [ ] Add analytics & error tracking (Sentry, etc.)
- [ ] Load test with k6/artillery
- [ ] Setup CI/CD pipeline
- [ ] Monitor Socket.IO connections

## Future Improvements

### Near-term
1. **Persistence**: Store call history, user activity
2. **TURN Servers**: Use coturn/TURN services for better NAT traversal
3. **Conference Calls**: Support 1-to-many with SFU (Selective Forwarding Unit)
4. **Call Recording**: Record RTC streams to server
5. **Video Quality**: Adaptive bitrate, codec negotiation

### Long-term
1. **SFU Architecture**: Scale to group calls with selective forwarding
2. **Message Queue**: Use Redis/RabbitMQ for distributed signaling
3. **Database Persistence**: Store call logs, user preferences
4. **Analytics**: Call duration, success rate, quality metrics
5. **Notifications**: Push notifications for missed calls
6. **Screen Sharing**: Support WebRTC screen capture

## Troubleshooting

### User appears offline but is connected
- Check firewall blocking WebSocket on port 4000
- Verify JWT token is valid
- Check browser console for connection errors

### WebRTC connection fails
- Ensure both parties completed call-accept before signaling
- Check that browser has camera/mic permissions
- May need TURN server if behind NAT
- Verify offer/answer SDP formats match

### Call stuck in "calling" state
- Client should emit call-reject or call-cancel
- Server cleanup on disconnect may be delayed
- Check client-side error handling

## Code Structure

```
src/
├── app.js                  # Express app setup
├── server.js               # HTTP server + Socket.IO init
├── config/
│   ├── db.js              # MongoDB connection
│   └── env.js             # Environment variables
├── controllers/
│   ├── auth.controller.js
│   ├── user.controller.js
│   └── contact.controller.js
├── models/
│   ├── users.model.js
│   └── contact.model.js
├── middleware/
│   ├── auth.middleware.js
│   ├── logging.middleware.js
│   └── validation.middleware.js
├── routes/
│   ├── auth.route.js
│   ├── user.route.js
│   └── contact.routes.js
├── socket/
│   └── socketHandler.js    # Socket.IO logic
└── utils/
    └── token.js           # JWT generation
```

## Performance Notes

- **Memory**: Presence + calls stored in memory (no DB hits during calls)
- **Latency**: Direct P2P media = low latency, server-side relay adds minimal overhead
- **Scalability**: Socket.IO easily scales to 10k+ concurrent connections with clustering
- **Bandwidth**: Server only relays signaling data, not media streams

## License

MIT
