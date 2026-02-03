# Backend Integration Guide

## 📋 Overview

This guide explains how to connect the frontend to a backend server and implement all API endpoints needed for the video calling app to function fully.

---

## 🔌 Current Architecture

### Frontend Service Layer
- **API Service** (`lib/api.ts`): HTTP client with authentication
- **Socket Service** (`lib/socket.ts`): Real-time communication
- **Environment Config** (`.env.local`): Endpoint configuration

### Expected Backend Stack
- **Node.js** with Express or similar
- **Database**: MongoDB, PostgreSQL, etc.
- **Socket.IO**: Real-time communication
- **Authentication**: JWT tokens
- **WebRTC**: Peer-to-peer video/audio

---

## 🛠 Backend Setup

### Required Endpoints

#### 1. Authentication Endpoints

```
POST /auth/login
POST /auth/register
POST /auth/logout
GET /auth/refresh-token
```

#### 2. User Management

```
GET /users/profile
GET /users/search?q=<query>
GET /users/online
GET /users/:id
PATCH /users/:id
```

#### 3. Contacts/Friends

```
GET /contacts
POST /contacts
DELETE /contacts/:id
GET /contacts/favorites
POST /contacts/:id/toggle-favorite
```

#### 4. Call History

```
GET /calls/history
POST /calls/history
GET /calls/:id
DELETE /calls/:id
```

#### 5. Presence/Status

```
PATCH /users/:id/status
GET /users/presence
```

---

## 🔐 Authentication Flow

### 1. Login Process

**Frontend**:
```typescript
const response = await apiService.login(username, password);
// Stores token in localStorage
```

**Backend**:
```javascript
POST /auth/login
Body: { username, password }
Response: { token, username, userId, expiresIn }
```

### 2. Token Storage

**Frontend** (`lib/api.ts`):
```typescript
setToken(token: string) {
  this.token = token;
  localStorage.setItem('authToken', token);
}

getHeaders() {
  return {
    'Authorization': `Bearer ${this.token}`,
    'Content-Type': 'application/json'
  };
}
```

### 3. Token Validation

All protected routes require:
```
Authorization: Bearer <token>
```

**Backend should verify** JWT in every request.

---

## 🔄 API Service Methods

### Current Implementation

**File**: `lib/api.ts`

```typescript
// Authentication
async login(username: string, password: string)
async register(username: string, password: string)
async logout()

// User Management
async getUser()
async searchUsers(query: string)
async getUserStatus(userId: string)
async updateUserStatus(status: string)

// Call History
async getCallHistory()
async saveCall(callData: object)

// Favorites
async getFavorites()
async toggleFavorite(userId: string)
```

### Error Handling

All methods return:
```typescript
{
  data?: T,
  error?: string
}
```

---

## 🔌 Socket.IO Implementation

### Current Setup

**File**: `lib/socket.ts`

```typescript
const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
  auth: {
    token: localStorage.getItem('authToken')
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});
```

### Required Socket Events

#### Incoming Events (Listen)

```typescript
// Presence
socket.on('user-online', (data) => {
  // { userId, username, timestamp }
});

socket.on('user-offline', (data) => {
  // { userId, username }
});

socket.on('presence-batch', (data) => {
  // List of all online users
});

// Calls
socket.on('incoming-call', (data) => {
  // { callerId, callerName, timestamp }
});

socket.on('call-accepted', (data) => {
  // { callId, recipientId }
});

socket.on('call-rejected', (data) => {
  // { callId, reason }
});

socket.on('call-ended', (data) => {
  // { callId, duration }
});

// WebRTC Signaling
socket.on('webrtc-offer', (data) => {
  // { from, offer: RTCSessionDescription }
});

socket.on('webrtc-answer', (data) => {
  // { from, answer: RTCSessionDescription }
});

socket.on('ice-candidate', (data) => {
  // { from, candidate: RTCIceCandidate }
});

// Messages (ready for future)
socket.on('message', (data) => {
  // { from, message, timestamp }
});
```

#### Outgoing Events (Emit)

```typescript
// Presence
socket.emit('set-online', { userId, username });
socket.emit('set-offline', { userId });
socket.emit('get-online-users');

// Calls
socket.emit('initiate-call', { recipientId });
socket.emit('accept-call', { callId });
socket.emit('reject-call', { callId, reason });
socket.emit('end-call', { callId });

// WebRTC Signaling
socket.emit('webrtc-offer', { to, offer });
socket.emit('webrtc-answer', { to, answer });
socket.emit('ice-candidate', { to, candidate });

// Status
socket.emit('update-status', { status }); // online/away/busy/offline
```

---

## 📱 Integration Steps

### Step 1: Setup Environment

Update `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

Or update for production:
```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_SOCKET_URL=https://yourdomain.com
```

### Step 2: Initialize Socket Connection

**Current Location**: Needs to be added to `AppDashboard.tsx`

```typescript
useEffect(() => {
  const token = localStorage.getItem('authToken');
  if (token) {
    socketService.connect(token);
    
    // Listen for presence updates
    socketService.on('user-online', (data) => {
      addLog(`${data.username} is now online`, 'success');
    });
    
    // Listen for incoming calls
    socketService.on('incoming-call', (data) => {
      setShowIncomingCall(true);
      setIncomingCaller(data.callerName);
    });
  }
  
  return () => socketService.disconnect();
}, []);
```

### Step 3: Update API Service

Modify `lib/api.ts` endpoint methods to match your backend:

```typescript
// Example for login
async login(username: string, password: string) {
  const response = await fetch(`${this.apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  
  const data = await response.json();
  if (data.token) {
    this.setToken(data.token);
  }
  
  return { data, error: response.ok ? null : data.error };
}
```

### Step 4: Implement WebRTC

Add WebRTC logic to `CallPage.tsx`:

```typescript
useEffect(() => {
  const initializeWebRTC = async () => {
    // Get user media
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true
    });
    
    // Create peer connection
    const peerConnection = new RTCPeerConnection();
    
    // Add tracks to connection
    stream.getTracks().forEach(track => {
      peerConnection.addTrack(track, stream);
    });
    
    // Handle remote stream
    peerConnection.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.emit('ice-candidate', {
          to: recipientId,
          candidate: event.candidate
        });
      }
    };
    
    // Create and send offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    socketService.emit('webrtc-offer', {
      to: recipientId,
      offer: offer
    });
  };
  
  initializeWebRTC();
}, [recipientId]);
```

---

## 🔄 Data Models

### User Model

```typescript
interface User {
  id: string;
  username: string;
  email: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: Date;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Call Record

```typescript
interface CallRecord {
  id: string;
  callerId: string;
  recipientId: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in seconds
  status: 'completed' | 'missed' | 'rejected';
  recordingUrl?: string;
}
```

### Contact

```typescript
interface Contact {
  id: number;
  name: string;
  status: string;
  time: string;
  isFavorite: boolean;
}
```

---

## 📡 Example Backend Setup (Node.js/Express)

### Quick Setup

```javascript
const express = require('express');
const cors = require('cors');
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');

const app = express();
const server = require('http').createServer(app);
const io = socketIO(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// Middleware: Verify JWT
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Auth Routes
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  // Verify credentials (check database)
  // ... your logic
  
  const token = jwt.sign(
    { userId: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  res.json({ token, username: user.username });
});

app.post('/auth/register', (req, res) => {
  // ... registration logic
});

// User Routes
app.get('/users/online', verifyToken, (req, res) => {
  // Return list of online users from database
  res.json(onlineUsers);
});

// Socket.IO
io.on('connection', (socket) => {
  const userId = socket.handshake.auth.token; // Verify this
  
  socket.on('set-online', (data) => {
    socket.broadcast.emit('user-online', data);
  });
  
  socket.on('initiate-call', (data) => {
    io.to(data.recipientId).emit('incoming-call', {
      callerId: userId,
      callerName: data.callerName
    });
  });
  
  socket.on('webrtc-offer', (data) => {
    io.to(data.to).emit('webrtc-offer', {
      from: userId,
      offer: data.offer
    });
  });
  
  // ... more socket handlers
});

server.listen(5000, () => {
  console.log('Server running on port 5000');
});
```

---

## 🔗 Database Schema Examples

### PostgreSQL

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'offline',
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contacts table
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Call History table
CREATE TABLE call_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID REFERENCES users(id),
  recipient_id UUID REFERENCES users(id),
  start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP,
  duration_seconds INT,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🧪 Testing API

### Using Postman

1. **Login**
```
POST http://localhost:5000/auth/login
Body: { "username": "demo", "password": "demo" }
```

2. **Get Online Users**
```
GET http://localhost:5000/users/online
Headers: { "Authorization": "Bearer <token>" }
```

3. **Get Call History**
```
GET http://localhost:5000/calls/history
Headers: { "Authorization": "Bearer <token>" }
```

---

## 🚀 Deployment Considerations

### Frontend Deployment (Vercel/Netlify)
```bash
npm run build
npm start
```

### Backend Deployment (Heroku/AWS/Digital Ocean)
- Set environment variables
- Configure CORS to allow frontend domain
- Set up database
- Configure Socket.IO for horizontal scaling

### HTTPS/WSS
- Use `https://` for API_URL
- Use `wss://` for SOCKET_URL in production

---

## 📊 Monitoring & Logging

### Frontend Logging
- All events logged in console panel
- localStorage for debugging
- Network tab in DevTools for API calls

### Backend Logging
- Log all API requests
- Log Socket.IO connections
- Monitor call duration
- Track error rates

---

## 🐛 Common Issues & Solutions

### Issue: CORS Error
**Solution**: Configure backend CORS:
```javascript
cors({ origin: 'http://localhost:3000' })
```

### Issue: Socket.IO Connection Fails
**Solution**: Check:
1. Backend Socket.IO is running
2. Correct port in `.env.local`
3. No firewall blocking websocket

### Issue: Auth Token Expires
**Solution**: Implement token refresh:
```typescript
// Intercept 401 responses and refresh token
```

### Issue: WebRTC No Video
**Solution**:
1. Check camera permissions
2. Verify getUserMedia() works
3. Check peer connection state

---

## ✅ Integration Checklist

- [ ] Backend server setup and running
- [ ] All API endpoints implemented
- [ ] JWT authentication working
- [ ] Socket.IO server configured
- [ ] Database connected
- [ ] Environment variables set
- [ ] Frontend connects to backend API
- [ ] Login/Register flow working
- [ ] Presence updates working
- [ ] Call history saving
- [ ] WebRTC signaling ready
- [ ] Testing with actual calls
- [ ] Error handling complete
- [ ] Production deployment

---

## 📞 API Response Format

All APIs should follow this format:

```typescript
// Success
{
  data: T,
  success: true,
  message: "Operation successful"
}

// Error
{
  error: "Error message",
  code: "ERROR_CODE",
  success: false
}
```

---

## 🔐 Security Best Practices

1. **JWT Expiration**: Set reasonable expiry (24h)
2. **Password Hashing**: Use bcrypt or similar
3. **Rate Limiting**: Prevent brute force attacks
4. **CORS**: Only allow your domain
5. **HTTPS**: Use in production
6. **Input Validation**: Sanitize all inputs
7. **SQL Injection**: Use parameterized queries
8. **CSRF Protection**: If needed

---

This guide should help you connect the frontend to your backend! Start with Step 1 and work through each section.
