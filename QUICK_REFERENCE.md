# 📋 Quick Reference Card

## Project Structure
```
src/
├── socket/socketHandler.js      ← WebRTC signaling engine
├── middleware/
│   ├── auth.middleware.js       ← JWT verification
│   ├── logging.middleware.js    ← Request logging
│   └── validation.middleware.js ← Input validation
├── routes/
│   ├── auth.route.js            ← /api/auth
│   ├── user.route.js            ← /api/users
│   └── contact.routes.js        ← /api/contacts
├── controllers/                 ← Business logic
├── models/                      ← MongoDB schemas
├── config/                      ← DB & env config
├── utils/token.js              ← JWT generation
├── app.js                       ← Express setup
└── server.js                    ← HTTP + Socket.IO
```

## Command Reference

```bash
# Development
npm run dev

# Install packages
npm install

# Check syntax
node -c src/server.js

# Start with PM2 (production)
pm2 start src/server.js --name "webrtc"
```

## Environment Variables

```
MONGODB_URI=mongodb://localhost:27017/video-call
JWT_SECRET=your-secret-key-here
PORT=4000
```

## Socket.IO Events Cheat Sheet

### Presence
```
→ emit('get-online-users')
← on('online-users', data)
← on('user-online', data)
← on('user-offline', data)
```

### Call Control
```
→ emit('call-request', { calleeId })
← on('incoming-call', { callId, callerId })
→ emit('call-accept', { callId })
→ emit('call-reject', { callId })
← on('call-accepted', data)
← on('call-rejected', data)
```

### WebRTC Signaling
```
→ emit('webrtc-offer', { callId, offer })
← on('webrtc-offer', { callId, offer })
→ emit('webrtc-answer', { callId, answer })
← on('webrtc-answer', { callId, answer })
→ emit('webrtc-ice-candidate', { callId, candidate })
← on('webrtc-ice-candidate', { callId, candidate })
```

### Call Termination
```
→ emit('call-hangup', { callId })
← on('call-ended', { callId, reason })
```

## REST API Cheat Sheet

```bash
# Register
POST /api/auth/register
{ "username": "alice", "password": "pass123" }

# Login
POST /api/auth/login
{ "username": "alice", "password": "pass123" }
→ { "token": "...", "userId": "...", "username": "..." }

# Search
GET /api/users/search?q=bob
Headers: Authorization: Bearer <token>

# Add Contact
POST /api/contacts/add
Headers: Authorization: Bearer <token>
{ "contactId": "..." }

# Health
GET /health
→ { "status": "ok" }
```

## State Management

### User Sessions (Memory)
```javascript
userSessions: Map {
  userId → {
    socketId,
    status: 'idle' | 'calling' | 'in-call',
    connectedAt: timestamp
  }
}
```

### Active Calls (Memory)
```javascript
activeCalls: Map {
  callId → {
    caller: userId,
    callee: userId,
    status: 'pending' | 'accepted' | 'active',
    createdAt: timestamp
  }
}
```

## Security Layers

| Layer | Mechanism | Limit |
|-------|-----------|-------|
| Auth | JWT token | Required on WebSocket & protected routes |
| Rate Limit | Per-IP tracking | 5 requests per 15 min on /api/auth |
| Validation | Input checks | Min length, type checks, sanitization |
| Authorization | Call participant check | Only caller/callee can relay WebRTC |
| Headers | Helmet middleware | Security headers on all responses |

## Error Responses

```javascript
// Invalid input
400: { "message": "Invalid username..." }

// Missing auth
401: { "message": "No token" }

// Unauthorized
403: { "message": "Unauthorized" }

// Not found / Offline
call-error: { "message": "User is offline" }

// Rate limited
429: Too Many Requests

// Server error
500: Internal Server Error
```

## Middleware Chain

```
Request
  ↓ Helmet (security headers)
  ↓ CORS
  ↓ Logging
  ↓ JSON parser
  ↓ Rate limiter (auth routes only)
  ↓ Validation
  ↓ JWT Auth (protected routes only)
  ↓ Route handler
  ↓ Response (logged)
```

## Client Connection Template

```javascript
const socket = io('http://localhost:4000', {
  auth: {
    token: jwtTokenFromLogin
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

socket.on('connect', () => console.log('Connected'));
socket.on('connect_error', (err) => console.error(err));
socket.on('disconnect', () => console.log('Disconnected'));
```

## Common Issues Quick Fixes

| Issue | Fix |
|-------|-----|
| "Cannot find module 'socket.io'" | npm install |
| "Authentication error" | Check JWT token valid + JWT_SECRET matches |
| "User is offline" | Check userSessions Map, reconnect user |
| "Call stuck pending" | Client should emit call-reject or call-cancel |
| "WebRTC connection fails" | Ensure call-accept before signaling |
| "Rate limited" | Wait 15 minutes or test from different IP |

## Performance Targets

```
Latency p50:     10 ms
Latency p99:     50 ms
Error rate:      <1%
Memory per user: 500 bytes
Concurrent connections: 50k+ per instance
```

## Deployment Checklist

- [ ] Install dependencies (`npm install`)
- [ ] Create .env file with secrets
- [ ] Verify MongoDB connection
- [ ] Change JWT_SECRET to random value
- [ ] Enable HTTPS
- [ ] Setup error tracking (Sentry)
- [ ] Setup monitoring (Prometheus/Grafana)
- [ ] Configure backups
- [ ] Test all endpoints
- [ ] Load test
- [ ] Deploy!

## Documentation Files

```
00_START_HERE.md          ← BEGIN HERE
README.md                 ← Full guide
QUICK_START.js            ← Client code
IMPLEMENTATION_SUMMARY.md ← What was built
ARCHITECTURE_DEEP_DIVE.md ← Deep dive
DEPLOYMENT_CHECKLIST.md   ← Testing & deployment
QUICK_REFERENCE.md        ← This file
```

## Key Concepts

### Control vs Media Plane
- **Control**: WebSocket events (signaling, presence)
- **Media**: Direct P2P UDP (audio/video)
- **Server Role**: Active (relay events), Not involved (media)

### Why Offline User = Immediate Error
- Presence stored in memory (userSessions Map)
- On call-request, check if callee exists in map
- Not found → offline → immediate error (no queue)

### Why Prevent Simultaneous Calls
- Status: idle → calling → in-call
- On call-request, check both parties idle
- Prevents broken state & confusion

### Why Direct P2P Media
- Saves server bandwidth (1-5 Mbps → 0)
- Reduces latency (direct connection)
- Scales infinitely (media not server-dependent)

## Interview Talking Points

**Architecture**: Control plane (signaling) separated from media plane (P2P)

**Security**: JWT authentication, rate limiting, input validation, authorization checks

**Scalability**: Direct P2P media (server bandwidth O(1)), Socket.IO supports 10k+ connections

**Edge Cases**: Offline users (immediate error), disconnect cleanup, prevent simultaneous calls

**Production**: HTTPS required, TURN servers for NAT, error tracking, monitoring

## Next Steps

1. **Read**: [00_START_HERE.md](00_START_HERE.md)
2. **Setup**: Create .env, run `npm install`
3. **Test**: `npm run dev`, check health endpoint
4. **Integrate**: Use [QUICK_START.js](QUICK_START.js) for client code
5. **Deploy**: Follow [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)

---

**Status**: ✅ Ready to Use

**Version**: 1.0 - MVP

**Last Updated**: 30 January 2026
