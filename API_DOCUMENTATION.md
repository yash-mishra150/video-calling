# API Documentation - Video Calling App

## Base URL
`http://localhost:5000`

---

## 📌 REST API Endpoints

### **1. Authentication APIs**

#### `POST /api/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "username": "john_doe",
  "password": "mypassword123"
}
```

**Response (201):**
```json
{
  "message": "Registered"
}
```

**Response (400):**
```json
{
  "message": "User exists"
}
```

---

#### `POST /api/auth/login`
Login to an existing account.

**Request Body:**
```json
{
  "username": "john_doe",
  "password": "mypassword123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "507f1f77bcf86cd799439011",
  "username": "john_doe"
}
```

**Response (401):**
```json
{
  "message": "Invalid credentials"
}
```

---

### **2. User APIs**

#### `GET /api/users/search?q=<query>`
Search for users by username (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `q` (optional): Search query string

**Response (200):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "username": "jane_doe"
  },
  {
    "_id": "507f1f77bcf86cd799439012",
    "username": "john_smith"
  }
]
```

---

#### `GET /api/users/call-history`
Get user's call history (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "callHistory": [
    {
      "participantId": "507f1f77bcf86cd799439011",
      "participantName": "jane_doe",
      "startTime": "2026-02-01T10:30:00.000Z",
      "endTime": "2026-02-01T10:45:30.000Z",
      "duration": 930,
      "callType": "outgoing",
      "_id": "507f1f77bcf86cd799439013"
    },
    {
      "participantId": "507f1f77bcf86cd799439014",
      "participantName": "john_smith",
      "startTime": "2026-02-01T09:15:00.000Z",
      "endTime": "2026-02-01T09:20:45.000Z",
      "duration": 345,
      "callType": "incoming",
      "_id": "507f1f77bcf86cd799439015"
    }
  ],
  "total": 2
}
```

**Response (404):**
```json
{
  "message": "User not found"
}
```

---

#### `DELETE /api/users/call-history`
Clear all call history (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "message": "Call history cleared"
}
```

---

### **3. Contact/Favorites APIs**

#### `POST /api/contacts/toggle-favorite`
Add or remove a user from favorites (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "userId": "507f1f77bcf86cd799439011"
}
```

**Response (200) - Added:**
```json
{
  "message": "Added to favorites",
  "isFavorited": true
}
```

**Response (200) - Removed:**
```json
{
  "message": "Removed from favorites",
  "isFavorited": false
}
```

**Response (400):**
```json
{
  "error": "Cannot favorite yourself"
}
```

**Response (404):**
```json
{
  "error": "User not found"
}
```

---

#### `GET /api/contacts/favorites`
Get list of favorited users (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "favorites": [
    {
      "userId": "507f1f77bcf86cd799439011",
      "username": "jane_doe"
    },
    {
      "userId": "507f1f77bcf86cd799439012",
      "username": "john_smith"
    }
  ]
}
```

---

#### `GET /api/contacts/is-favorited?userId=<userId>`
Check if a user is in favorites (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `userId` (required): User ID to check

**Response (200):**
```json
{
  "isFavorited": true
}
```

---

#### `GET /api/contacts/friends`
Get list of friends (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "friends": [
    {
      "friendId": "507f1f77bcf86cd799439011",
      "friendName": "jane_doe"
    }
  ]
}
```

---

#### `POST /api/contacts/remove-friend`
Remove a friend (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "friendId": "507f1f77bcf86cd799439011"
}
```

**Response (200):**
```json
{
  "message": "Friend removed successfully"
}
```

**Response (404):**
```json
{
  "error": "User not found"
}
```

---

## 🔌 Socket.IO Events

### **Connection**

#### Client → Server: `connect`
Establish WebSocket connection with JWT token.

**Connection Auth:**
```javascript
io('http://localhost:5000', {
  auth: { token: 'your-jwt-token' }
});
```

---

### **Presence Events**

#### Client → Server: `get-online-friends`
Request list of online friends.

**Emit:**
```javascript
socket.emit('get-online-friends');
```

**Server → Client: `online-friends`**
```javascript
{
  friends: [
    {
      userId: "507f1f77bcf86cd799439011",
      username: "jane_doe",
      status: "online" // or "away", "busy"
    }
  ]
}
```

---

#### Client → Server: `heartbeat`
Send heartbeat to keep connection alive.

**Emit:**
```javascript
socket.emit('heartbeat');
```

**Server → Client: `heartbeat-ack`**
```javascript
// No data, just acknowledgment
```

---

#### Client → Server: `set-status`
Change user status.

**Emit:**
```javascript
socket.emit('set-status', {
  status: "away" // "online", "away", "busy"
});
```

**Server → Client: `status-updated`**
```javascript
{
  status: "away"
}
```

**Server → Client: `status-error`**
```javascript
{
  message: "Invalid status"
}
```

---

#### Client → Server: `get-user-presence`
Get presence info for specific user.

**Emit:**
```javascript
socket.emit('get-user-presence', {
  targetUserId: "507f1f77bcf86cd799439011"
});
```

**Server → Client: `user-presence`**
```javascript
{
  userId: "507f1f77bcf86cd799439011",
  status: "online",
  lastSeen: 1738404000000
}
```

---

#### Server → Client: `friend-online`
Notifies when a friend comes online.

```javascript
{
  userId: "507f1f77bcf86cd799439011",
  username: "jane_doe",
  status: "online"
}
```

---

#### Server → Client: `friend-offline`
Notifies when a friend goes offline.

```javascript
{
  userId: "507f1f77bcf86cd799439011",
  status: "offline"
}
```

---

#### Server → Client: `presence-batch`
Batch presence updates (efficient).

```javascript
{
  updates: [
    { userId: "...", username: "jane_doe", status: "online" },
    { userId: "...", username: "john_smith", status: "away" }
  ]
}
```

---

### **Call Events**

#### Client → Server: `call-request`
Initiate a call to another user.

**Emit:**
```javascript
socket.emit('call-request', {
  calleeId: "507f1f77bcf86cd799439011"
});
```

**Server → Client: `call-initiated`**
```javascript
{
  callId: "user1-user2-1738404123456"
}
```

**Server → Client: `call-error`**
```javascript
{
  message: "User is offline" // or "You are already in a call", etc.
}
```

**Server → Callee: `incoming-call`**
```javascript
{
  callId: "user1-user2-1738404123456",
  callerId: "507f1f77bcf86cd799439010",
  callerName: "john_doe"
}
```

---

#### Client → Server: `call-accept`
Accept an incoming call.

**Emit:**
```javascript
socket.emit('call-accept', {
  callId: "user1-user2-1738404123456"
});
```

**Server → Both: `call-accepted`**
```javascript
{
  callId: "user1-user2-1738404123456",
  calleeId: "507f1f77bcf86cd799439011" // for caller
  // OR
  callerId: "507f1f77bcf86cd799439010" // for callee
}
```

---

#### Client → Server: `call-reject`
Reject an incoming call.

**Emit:**
```javascript
socket.emit('call-reject', {
  callId: "user1-user2-1738404123456"
});
```

**Server → Caller: `call-rejected`**
```javascript
{
  callId: "user1-user2-1738404123456",
  reason: "User rejected"
}
```

---

#### Client → Server: `call-cancel`
Cancel a pending call before it's answered.

**Emit:**
```javascript
socket.emit('call-cancel', {
  callId: "user1-user2-1738404123456"
});
```

**Server → Callee: `call-cancelled`**
```javascript
{
  callId: "user1-user2-1738404123456"
}
```

---

#### Client → Server: `call-hangup`
End an active call.

**Emit:**
```javascript
socket.emit('call-hangup', {
  callId: "user1-user2-1738404123456"
});
```

**Server → Both: `call-ended`**
```javascript
{
  callId: "user1-user2-1738404123456",
  reason: "You hung up" // or "Other party hung up"
}
```

---

### **WebRTC Signaling Events**

#### Client → Server: `webrtc-offer`
Send WebRTC offer to callee.

**Emit:**
```javascript
socket.emit('webrtc-offer', {
  callId: "user1-user2-1738404123456",
  offer: { type: 'offer', sdp: '...' }
});
```

**Server → Callee: `webrtc-offer`**
```javascript
{
  callId: "user1-user2-1738404123456",
  offer: { type: 'offer', sdp: '...' }
}
```

---

#### Client → Server: `webrtc-answer`
Send WebRTC answer to caller.

**Emit:**
```javascript
socket.emit('webrtc-answer', {
  callId: "user1-user2-1738404123456",
  answer: { type: 'answer', sdp: '...' }
});
```

**Server → Caller: `webrtc-answer`**
```javascript
{
  callId: "user1-user2-1738404123456",
  answer: { type: 'answer', sdp: '...' }
}
```

---

#### Client → Server: `webrtc-ice-candidate`
Exchange ICE candidates for P2P connection.

**Emit:**
```javascript
socket.emit('webrtc-ice-candidate', {
  callId: "user1-user2-1738404123456",
  candidate: { candidate: '...', sdpMLineIndex: 0 }
});
```

**Server → Other Party: `webrtc-ice-candidate`**
```javascript
{
  callId: "user1-user2-1738404123456",
  candidate: { candidate: '...', sdpMLineIndex: 0 }
}
```

**Server → Client: `webrtc-error`**
```javascript
{
  message: "Call not accepted" // or other error
}
```

---

### **Media Control Events**

#### Client → Server: `mic-toggled`
Notify when microphone is toggled.

**Emit:**
```javascript
socket.emit('mic-toggled', {
  callId: "user1-user2-1738404123456",
  enabled: false // true = ON, false = OFF
});
```

**Server → Other Party: `remote-mic-toggled`**
```javascript
{
  callId: "user1-user2-1738404123456",
  enabled: false,
  userId: "507f1f77bcf86cd799439010"
}
```

---

#### Client → Server: `camera-toggled`
Notify when camera is toggled.

**Emit:**
```javascript
socket.emit('camera-toggled', {
  callId: "user1-user2-1738404123456",
  enabled: true // true = ON, false = OFF
});
```

**Server → Other Party: `remote-camera-toggled`**
```javascript
{
  callId: "user1-user2-1738404123456",
  enabled: true,
  userId: "507f1f77bcf86cd799439010"
}
```

---

### **Friend Events (Internal Use)**

These are triggered internally by the backend, not directly by clients:

#### `friend-request-sent`
#### `friend-request-accepted`
#### `friend-removed`

**Server → Client: `friend-request-received`**
```javascript
{
  requesterId: "507f1f77bcf86cd799439010",
  requesterName: "john_doe"
}
```

**Server → Client: `friend-request-approved`**
```javascript
{
  friendId: "507f1f77bcf86cd799439011",
  friendName: "jane_doe"
}
```

**Server → Client: `friend-removed-by`**
```javascript
{
  userId: "507f1f77bcf86cd799439010",
  username: "john_doe"
}
```

---

## 📋 Data Models

### **Call History Entry**
```javascript
{
  participantId: ObjectId,
  participantName: String,
  startTime: Date,
  endTime: Date,
  duration: Number, // seconds
  callType: "incoming" | "outgoing" | "missed"
}
```

### **User Presence Statuses**
- `online` - User is active
- `away` - User is inactive
- `busy` - User is in a call
- `offline` - User is disconnected

---

## 🚀 Quick Start Example

### Authentication Flow
```javascript
// 1. Register
const registerResponse = await fetch('http://localhost:5000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'john', password: 'pass123' })
});

// 2. Login
const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'john', password: 'pass123' })
});
const { token, userId } = await loginResponse.json();

// 3. Connect Socket
const socket = io('http://localhost:5000', {
  auth: { token }
});

// 4. Listen for events
socket.on('connect', () => {
  console.log('Connected!');
  socket.emit('get-online-friends');
});

socket.on('online-friends', ({ friends }) => {
  console.log('Online friends:', friends);
});
```

### Making an Authenticated API Call
```javascript
const response = await fetch('http://localhost:5000/api/users/call-history', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
console.log('Call history:', data.callHistory);
```

### Initiating a Video Call
```javascript
// 1. Request call
socket.emit('call-request', { calleeId: 'target-user-id' });

// 2. Listen for call initiated
socket.on('call-initiated', ({ callId }) => {
  console.log('Call initiated:', callId);
});

// 3. When other party accepts
socket.on('call-accepted', ({ callId }) => {
  // Start WebRTC connection
  createPeerConnection(callId);
});

// 4. Exchange WebRTC signals
socket.on('webrtc-offer', async ({ offer }) => {
  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('webrtc-answer', { callId, answer });
});
```

---

## 📝 Notes

- All authenticated endpoints require `Authorization: Bearer <token>` header
- Socket.IO connection requires JWT token in `auth` field
- Call IDs are generated by server in format: `userId1-userId2-timestamp`
- Presence status is automatically set to "busy" during calls
- Call history is saved only when `call-hangup` event is triggered
- WebRTC signaling happens through Socket.IO, but actual media flows P2P

---

**Backend Port:** `5000`  
**MongoDB:** Required (configure in `.env`)  
**Socket.IO Version:** `4.7.2`
