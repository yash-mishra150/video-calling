# Architecture Deep Dive

## High-Level System Diagram

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                           CLIENT BROWSER                              ┃
┃  ┌─────────────────────────────────────────────────────────────────┐ ┃
┃  │ WebRTC API                                                      │ ┃
┃  │ ├─ RTCPeerConnection                                           │ ┃
┃  │ ├─ getUserMedia (audio/video)                                  │ ┃
┃  │ └─ ICE candidates                                              │ ┃
┃  └─────────────────────────────────────────────────────────────────┘ ┃
┃  ┌─────────────────────────────────────────────────────────────────┐ ┃
┃  │ Socket.IO Client                                                │ ┃
┃  │ Events: call-request, webrtc-offer, webrtc-ice-candidate      │ ┃
┃  └─────────────────────────────────────────────────────────────────┘ ┃
┗━━━━━┬━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
      │
      │ WebSocket (json events)
      │ + HTTP (JWT-protected)
      │
┏━━━━━┴━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                        SIGNALING SERVER                              ┃
┃                     (Node.js + Express + Socket.IO)                ┃
┃                                                                      ┃
┃  ┌───────────────────────────────────────────────────────────────┐ ┃
┃  │ Socket.IO Handler                                             │ ┃
┃  │ - Authentication (JWT)                                        │ ┃
┃  │ - Presence tracking (userSessions Map)                       │ ┃
┃  │ - Call state management (activeCalls Map)                    │ ┃
┃  │ - WebRTC relay (offer/answer/ICE)                            │ ┃
┃  └───────────────────────────────────────────────────────────────┘ ┃
┃                                                                      ┃
┃  ┌───────────────────────────────────────────────────────────────┐ ┃
┃  │ Express Middleware Stack                                       │ ┃
┃  │ 1. Helmet (security headers)                                  │ ┃
┃  │ 2. CORS                                                       │ ┃
┃  │ 3. Request Logging                                            │ ┃
┃  │ 4. Rate Limiting (auth routes)                                │ ┃
┃  │ 5. JSON parsing                                               │ ┃
┃  │ 6. Input Validation                                           │ ┃
┃  │ 7. JWT Auth (protected routes)                                │ ┃
┃  │ 8. Route handler                                              │ ┃
┃  └───────────────────────────────────────────────────────────────┘ ┃
┃                                                                      ┃
┃  ┌───────────────────────────────────────────────────────────────┐ ┃
┃  │ MongoDB (Persistent Data)                                     │ ┃
┃  │ - Users (id, username, password_hash)                         │ ┃
┃  │ - Contacts (owner, contact)                                   │ ┃
┃  │ NOTE: Presence & calls NOT in DB (in-memory only)            │ ┃
┃  └───────────────────────────────────────────────────────────────┘ ┃
┗━━━━━┬━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
      │
      │ Direct P2P (UDP)
      │ Media only - NO server involvement
      │
     ╱ ╲
    ╱   ╲
   Alice   Bob
```

## Request/Response Flow Examples

### Example 1: User Login

```
CLIENT                              SERVER
  │
  ├─ POST /api/auth/login
  │  Body: { username, password }
  │                                      ├─ Hash password check
  │                                      ├─ Generate JWT
  │                                      ├─ Log: POST /api/auth/login - 200 - 12ms
  │  ◄─────── 200 OK ─────────────────┤
  │  { token, userId, username }       │
  │
```

### Example 2: Call Request

```
ALICE                              SERVER                            BOB

  ├─ emit('call-request',
  │   { calleeId: bob_id })
  │                                   ├─ Check Bob online? YES
  │                                   ├─ Check Alice idle? YES
  │                                   ├─ Check Bob idle? YES
  │                                   ├─ Create call record
  │                                   ├─ Update: alice.status = 'calling'
  │                                   ├─ Update: bob.status = 'calling'
  │                                   ├─ Log: [CALL] Request: alice -> bob
  │                                   │
  │                                   ├─ emit('incoming-call')
  │                                   │  { callId, callerId, callerName }
  │                                   ├──────────────────► Bob receives
  │                                   │
  │  emit('call-initiated')          │
  │  { callId }                       │
  │  ◄────────────────────────────────┤
  │
  │  [Bob clicks ACCEPT]              │
  │                                   │
  │                            Bob emits('call-accept')
  │                            { callId }
  │                                   ├─ callRecord.status = 'accepted'
  │                                   ├─ alice.status = 'in-call'
  │                                   ├─ bob.status = 'in-call'
  │                                   ├─ Log: [CALL] ACCEPTED: callId
  │                                   │
  │                                   ├─ emit('call-accepted')
  │                                   │  { callId, calleeId: bob_id }
  │  ◄────────────────────────────────┤
  │  START WEBRTC SIGNALING           │
```

### Example 3: WebRTC Signaling

```
ALICE                              SERVER                            BOB

  ├─ createOffer()                  │
  │  (SDP offer)                    │
  │                                   │
  ├─ emit('webrtc-offer',
  │   { callId, offer })
  │                                   ├─ Validate: call status = 'accepted'
  │                                   ├─ Validate: Alice is caller
  │                                   ├─ Log: [WEBRTC] Offer relayed
  │                                   │
  │                                   ├─ emit('webrtc-offer')
  │                                   │  { callId, offer }
  │                                   ├──────────────────► Bob receives
  │                                   │
  │                                   │  Bob: setRemoteDescription(offer)
  │                                   │  Bob: createAnswer() (SDP answer)
  │                                   │
  │                                   │  emit('webrtc-answer',
  │                                   │   { callId, answer })
  │                                   ├─ Log: [WEBRTC] Answer relayed
  │                                   │
  │  ◄──────────────────────────────┼──┤ Alice receives answer
  │  Alice: setRemoteDescription(answer)
  │                                   │
  │  [MEDIA FLOW ESTABLISHED]         │
  │  ◄─────── P2P Audio/Video ────────► 
  │  (UDP, NO SERVER INVOLVEMENT)     │
```

### Example 4: Call Hangup

```
ALICE                              SERVER                            BOB

  ├─ emit('call-hangup',
  │   { callId })
  │                                   ├─ Find other party: bob_id
  │                                   ├─ alice.status = 'idle'
  │                                   ├─ bob.status = 'idle'
  │                                   ├─ Log: [CALL] ENDED: callId
  │                                   │
  │                                   ├─ emit('call-ended',
  │                                   │   { reason: 'Other party hung up' })
  │                                   ├──────────────────► Bob receives
  │                                   │
  │  emit('call-ended')              │
  │  { reason: 'You hung up' }       │
  │  ◄────────────────────────────────┤
  │  Close peer connection            │  Close peer connection
```

## In-Memory State Management

### User Sessions (Reset on disconnect)

```javascript
userSessions = Map {
  'user-1' => {
    socketId: 'socket-abc123',
    status: 'idle' | 'calling' | 'in-call',
    connectedAt: 1674823456123
  },
  'user-2' => {
    socketId: 'socket-def456',
    status: 'in-call',
    connectedAt: 1674823500000
  }
}

// Time complexity:
// Get user: O(1)
// Set status: O(1)
// List all: O(n) but n = concurrent users (typically <10k)
```

### Active Calls (Reset on hangup)

```javascript
activeCalls = Map {
  'user-1-user-2-1674823456123' => {
    callId: 'user-1-user-2-1674823456123',
    caller: 'user-1',
    callee: 'user-2',
    status: 'pending' | 'accepted' | 'active',
    createdAt: 1674823456123
  }
}

// Time complexity:
// Get call: O(1)
// Find by caller: O(n) but n = active calls (typically <1000)
// Find by callee: O(n)
```

## Security Event Flow

```
1. CLIENT CONNECTS
   ├─ Browser: io('http://localhost:4000', { auth: { token } })
   │
   SERVER:
   ├─ Extract token from handshake.auth
   ├─ jwt.verify(token, JWT_SECRET)
   │  ├─ Valid? → Register user session → emit 'user-online'
   │  └─ Invalid? → reject('Authentication error')

2. CLIENT MAKES API CALL
   ├─ Browser: Authorization: Bearer <token>
   │
   SERVER:
   ├─ Express middleware chain:
   │  ├─ Helmet: add security headers
   │  ├─ Logging: log request
   │  ├─ Rate Limiter: check (if /api/auth)
   │  ├─ Validation: sanitize input
   │  ├─ Auth middleware: verify JWT
   │  ├─ Route handler: execute
   │  └─ Log: POST /api/users/search - 200 - 8ms

3. CALL INITIATION
   ├─ Browser: emit('call-request', { calleeId })
   │
   SERVER:
   ├─ socketHandler:
   │  ├─ Check: calleeId is valid ObjectId? YES
   │  ├─ Check: callee is online? Check userSessions
   │  ├─ Check: caller is idle? Check status
   │  ├─ Check: callee is idle? Check status
   │  ├─ All pass → create call, update statuses
   │  └─ Fail → emit error with reason

4. WEBRTC OFFER
   ├─ Browser: emit('webrtc-offer', { callId, offer })
   │
   SERVER:
   ├─ socketHandler:
   │  ├─ Check: callRecord exists?
   │  ├─ Check: call status = 'accepted'?
   │  ├─ Check: caller is socket.userId?
   │  ├─ All pass → relay to callee
   │  └─ Fail → emit webrtc-error
```

## Error Handling Strategy

```
TYPE              EXAMPLE                        RESPONSE
─────────────────────────────────────────────────────────────
Validation        Invalid username              400 Bad Request
Authentication    Missing JWT token             401 Unauthorized
Authorization     User not call participant     403 Forbidden
Call State        WebRTC before accept          ERROR event
User Offline      Call to offline user          call-error event
Rate Limit        >5 auth attempts/15min        429 Too Many Requests
Server Error      DB connection failure         500 Internal Error
```

## Middleware Execution Order

```
REQUEST
  │
  ├─ helmet()                     [Security headers]
  │  Add: X-Content-Type-Options, X-Frame-Options, etc.
  │
  ├─ cors()                        [CORS handling]
  │  Allow cross-origin if configured
  │
  ├─ loggingMiddleware()          [Request logging]
  │  Log: method, route, status, duration
  │
  ├─ express.json()                [Body parsing]
  │  Parse JSON body
  │
  ├─ authLimiter                  [Rate limiting]
  │  If route = /api/auth: check limit
  │  Else: pass through
  │
  ├─ validateAuth()               [Input validation]
  │  If route = /api/auth: validate + sanitize
  │  Else: pass through
  │
  ├─ auth.middleware()            [JWT verification]
  │  If protected route: verify token
  │  Else: pass through
  │
  └─ Route Handler
      └─ Response
           │
           └─ res.send() [triggers logging]
                 │
                 └─ RESPONSE
```

## Memory Usage Estimation

```
Per User Session:     ~500 bytes (socketId, status, timestamp)
Per Active Call:      ~1000 bytes (callId, userIds, status, timestamp)

Example: 10,000 concurrent users, 500 active calls
├─ userSessions: 10,000 × 500B = 5 MB
├─ activeCalls: 500 × 1000B = 500 KB
└─ Total: ~5.5 MB (negligible)

Scales to:
  - 100k users: 50 MB
  - 1M users: 500 MB (use horizontal scaling at this point)
```

## Scalability Path

```
PHASE 1: MVP (Current)
  ├─ Single Node.js instance
  ├─ In-memory state (userSessions, activeCalls)
  ├─ Can handle: ~50k concurrent connections
  └─ Suitable for: Beta testing, small user base

PHASE 2: Multiple Instances
  ├─ Add Redis adapter for Socket.IO
  ├─ Sessions stored in Redis (not in-memory)
  ├─ Can handle: 100k+ concurrent connections
  └─ Add: Nginx load balancer

PHASE 3: Microservices (Optional)
  ├─ Separate signaling service
  ├─ Add SFU (Selective Forwarding Unit) for group calls
  ├─ Database for call history
  └─ Can handle: Unlimited scale
```

## Interview Questions This Addresses

**Q: How do you prevent two users from having simultaneous calls?**
A: We track user status in memory: idle → calling → in-call. On each call-request, we check both parties' status. If either is not idle, we reject with appropriate error.

**Q: What happens if a user is offline when someone calls them?**
A: We maintain a userSessions Map that's updated on connect/disconnect. When call-request arrives, we check if callee exists in this map. If not (offline), we immediately return error. No queue, no wait.

**Q: Why doesn't the server handle media?**
A: WebRTC is peer-to-peer. After signaling (offer/answer), peers exchange ICE candidates and establish direct UDP connection. Server only relays offer/answer/ICE—not media. This saves server bandwidth and gives lowest latency.

**Q: What happens if a client disconnects during a call?**
A: Socket.io disconnect event fires. We find any active calls involving this user, notify the other party with "Other party disconnected", and clean up (delete call record, reset statuses). The other party can then close their RTCPeerConnection gracefully.

**Q: How do you ensure only authorized parties see signaling data?**
A: Each WebRTC event (offer, answer, ICE) includes callId. We validate that the sending socket.userId is either the caller or callee of that callId. If not, we emit error.
