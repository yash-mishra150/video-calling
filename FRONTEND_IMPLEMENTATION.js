/**
 * COMPLETE FRONTEND IMPLEMENTATION GUIDE
 * 1-to-1 WebRTC Video Calling Application
 * 
 * Use this as a prompt/reference for frontend development
 */

// ============================================================================
// SECTION 1: INITIALIZATION & SOCKET CONNECTION
// ============================================================================

/**
 * Step 1: User Registration
 */
async function registerUser(username, password) {
  try {
    const response = await fetch('http://localhost:4000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      throw new Error('Registration failed');
    }

    const data = await response.json();
    console.log('✅ User registered:', data.message);
    return true;
  } catch (error) {
    console.error('❌ Registration error:', error.message);
    return false;
  }
}

/**
 * Step 2: User Login - Get JWT Token
 */
async function loginUser(username, password) {
  try {
    const response = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const { token, userId, username: returnedUsername } = await response.json();
    
    // Store in localStorage for persistence
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
    localStorage.setItem('username', returnedUsername);

    console.log('✅ Logged in as:', returnedUsername);
    console.log('✅ User ID:', userId);

    return { token, userId, username: returnedUsername };
  } catch (error) {
    console.error('❌ Login error:', error.message);
    return null;
  }
}

/**
 * Step 3: Connect Socket.IO with JWT Token
 * CRITICAL: Token MUST be included in auth for WebSocket connection
 */
function connectSocket() {
  const token = localStorage.getItem('token');

  if (!token) {
    console.error('❌ No token found. Please login first.');
    return null;
  }

  // ✅ CORRECT CONNECTION
  const socket = io('http://localhost:4000', {
    auth: {
      token: token  // MUST include JWT token
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
  });

  // Connection events
  socket.on('connect', () => {
    console.log('✅ Socket connected - You are now ONLINE');
    console.log('Socket ID:', socket.id);
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error.message);
    // If "Authentication error", token is invalid or expired
  });

  socket.on('disconnect', () => {
    console.log('⚠️  Socket disconnected - You are now OFFLINE');
  });

  return socket;
}

// ============================================================================
// SECTION 2: PRESENCE & USER SEARCH
// ============================================================================

/**
 * Get list of all online users
 */
function getOnlineUsers(socket) {
  socket.emit('get-online-users');

  socket.on('online-users', ({ users }) => {
    console.log('👥 Online users:', users);
    displayOnlineUsers(users);
  });
}

/**
 * Listen for real-time presence updates
 */
function listenToPresence(socket) {
  socket.on('user-online', ({ userId }) => {
    console.log(`✅ ${userId} came online`);
    updateUserPresence(userId, 'online');
  });

  socket.on('user-offline', ({ userId }) => {
    console.log(`🔴 ${userId} went offline`);
    updateUserPresence(userId, 'offline');
  });
}

/**
 * Search for users by username
 */
async function searchUsers(searchQuery) {
  try {
    const token = localStorage.getItem('token');

    const response = await fetch(
      `http://localhost:4000/api/users/search?q=${encodeURIComponent(searchQuery)}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    const users = await response.json();
    console.log('🔍 Search results:', users);
    return users; // [{ _id: '...', username: 'alice' }, ...]
  } catch (error) {
    console.error('❌ Search error:', error.message);
    return [];
  }
}

/**
 * Add user to contacts
 */
async function addContact(contactId) {
  try {
    const token = localStorage.getItem('token');

    const response = await fetch('http://localhost:4000/api/contacts/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ contactId })
    });

    const data = await response.json();
    console.log('✅ Contact added:', data.message);
    return true;
  } catch (error) {
    console.error('❌ Add contact error:', error.message);
    return false;
  }
}

// ============================================================================
// SECTION 3: CALL INITIATION & FLOW
// ============================================================================

/**
 * Initiate a call to another user
 */
function initiateCall(socket, calleeId) {
  console.log(`📞 Calling ${calleeId}...`);

  socket.emit('call-request', { calleeId });

  // Caller receives confirmation
  socket.on('call-initiated', ({ callId }) => {
    console.log('✅ Call initiated. Call ID:', callId);
    console.log('⏳ Waiting for response...');
    window.callId = callId;
  });

  // Caller receives error if user offline or already in call
  socket.on('call-error', ({ message }) => {
    console.error('❌ Call error:', message);
    // Possible messages:
    // - "User is offline" → Receiver not connected
    // - "You are already in a call" → You're already calling someone
    // - "User is already in a call" → Receiver is on another call
    alert(`Call failed: ${message}`);
  });

  // Caller receives when callee accepts
  socket.on('call-accepted', ({ callId, calleeId }) => {
    console.log('✅ Call accepted by', calleeId);
    console.log('🔄 Starting WebRTC signaling...');
    startWebRTC(socket, callId, calleeId, true); // true = caller
  });

  // Caller receives when callee rejects
  socket.on('call-rejected', ({ callId, reason }) => {
    console.log('❌ Call rejected:', reason);
    alert(`Call rejected: ${reason}`);
  });

  // Caller receives when callee cancels
  socket.on('call-cancelled', ({ callId }) => {
    console.log('❌ Call was cancelled');
    alert('Call was cancelled');
  });
}

/**
 * Receiver: Listen for incoming calls
 */
function listenForIncomingCalls(socket) {
  socket.on('incoming-call', ({ callId, callerId, callerName }) => {
    console.log(`📞 Incoming call from ${callerName} (${callerId})`);
    window.incomingCallId = callId;
    window.incomingCallerId = callerId;

    // Show UI for accepting/rejecting call
    showIncomingCallUI(socket, callId, callerId, callerName);
  });
}

/**
 * Receiver: Accept incoming call
 */
function acceptCall(socket, callId) {
  socket.emit('call-accept', { callId });

  // Receiver gets confirmation
  socket.on('call-accepted', ({ callId, callerId }) => {
    console.log('✅ Call accepted');
    console.log('🔄 Starting WebRTC signaling...');
    startWebRTC(socket, callId, callerId, false); // false = callee
  });
}

/**
 * Receiver: Reject incoming call
 */
function rejectCall(socket, callId) {
  socket.emit('call-reject', { callId });
  console.log('❌ Call rejected');
}

/**
 * Either party: End the call
 */
function hangupCall(socket, callId, peerConnection) {
  console.log('📵 Hanging up...');

  if (peerConnection) {
    peerConnection.close();
  }

  socket.emit('call-hangup', { callId });

  // Both parties receive notification
  socket.on('call-ended', ({ callId, reason }) => {
    console.log('📵 Call ended:', reason);
    closeCallUI();
  });
}

// ============================================================================
// SECTION 4: WEBRTC SIGNALING & MEDIA
// ============================================================================

/**
 * Start WebRTC peer connection and signaling
 * isCallerFlag: true if you are the caller, false if you are the callee
 */
async function startWebRTC(socket, callId, remotePeerId, isCallerFlag) {
  console.log(`🎥 Starting WebRTC (${isCallerFlag ? 'Caller' : 'Callee'})...`);

  try {
    // Create RTCPeerConnection
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302'] }, // Google STUN
        { urls: ['stun:stun1.l.google.com:19302'] }
      ]
    });

    // Store for later reference
    window.peerConnection = peerConnection;

    // ========== GET LOCAL MEDIA ==========
    console.log('🎤 Requesting camera and microphone...');
    const localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    console.log('✅ Camera and microphone granted');

    // Add tracks to peer connection
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Display local video
    const localVideo = document.getElementById('local-video');
    if (localVideo) {
      localVideo.srcObject = localStream;
    }

    // ========== ICE CANDIDATE HANDLING ==========
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Sending ICE candidate...');
        socket.emit('webrtc-ice-candidate', {
          callId,
          candidate: event.candidate
        });
      }
    };

    // Receive ICE candidates from other party
    socket.on('webrtc-ice-candidate', ({ candidate }) => {
      console.log('🧊 Received ICE candidate');
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });

    // ========== REMOTE STREAM HANDLING ==========
    peerConnection.ontrack = (event) => {
      console.log('📹 Received remote stream');
      const remoteVideo = document.getElementById('remote-video');
      if (remoteVideo) {
        remoteVideo.srcObject = event.streams[0];
      }
    };

    // ========== OFFER/ANSWER EXCHANGE ==========

    if (isCallerFlag) {
      // CALLER sends offer
      console.log('📤 Creating and sending offer...');
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      await peerConnection.setLocalDescription(new RTCSessionDescription(offer));

      socket.emit('webrtc-offer', { callId, offer });

      console.log('✅ Offer sent');
    }

    // CALLEE receives offer and sends answer
    socket.on('webrtc-offer', async ({ offer }) => {
      console.log('📥 Received offer');

      if (!isCallerFlag) {
        // Only callee should create answer
        console.log('📥 Callee: Setting remote description from offer...');
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(offer)
        );

        console.log('📤 Callee: Creating and sending answer...');
        const answer = await peerConnection.createAnswer();

        await peerConnection.setLocalDescription(
          new RTCSessionDescription(answer)
        );

        socket.emit('webrtc-answer', { callId, answer });

        console.log('✅ Answer sent');
      }
    });

    // CALLER receives answer
    socket.on('webrtc-answer', async ({ answer }) => {
      console.log('📥 Received answer');

      if (isCallerFlag) {
        console.log('📥 Caller: Setting remote description from answer...');
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(answer)
        );

        console.log('✅ Remote description set. Connection should be established.');
      }
    });

    // ========== CONNECTION STATE MONITORING ==========
    peerConnection.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', peerConnection.connectionState);

      switch (peerConnection.connectionState) {
        case 'connected':
          console.log('✅ Peer connection established');
          showCallActive();
          break;
        case 'disconnected':
          console.log('⚠️  Peer connection disconnected');
          break;
        case 'failed':
          console.log('❌ Peer connection failed');
          alert('Connection failed. Please try again.');
          break;
        case 'closed':
          console.log('📵 Peer connection closed');
          break;
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', peerConnection.iceConnectionState);
    };

    peerConnection.onsignalingstatechange = () => {
      console.log('📡 Signaling state:', peerConnection.signalingState);
    };

    // ========== HANGUP BUTTON ==========
    const hangupBtn = document.getElementById('hangup-btn');
    if (hangupBtn) {
      hangupBtn.onclick = () => {
        hangupCall(socket, callId, peerConnection);
      };
    }

    // ========== LISTEN FOR CALL END ==========
    socket.on('call-ended', ({ callId: endedCallId, reason }) => {
      if (endedCallId === callId) {
        console.log('📵 Call ended:', reason);
        peerConnection.close();
        closeCallUI();
      }
    });

  } catch (error) {
    console.error('❌ WebRTC error:', error);
    alert(`WebRTC error: ${error.message}`);
  }
}

// ============================================================================
// SECTION 5: UI HELPER FUNCTIONS
// ============================================================================

/**
 * Display list of online users in UI
 */
function displayOnlineUsers(users) {
  const userList = document.getElementById('online-users-list');
  if (!userList) return;

  userList.innerHTML = '';
  users.forEach(userId => {
    const div = document.createElement('div');
    div.className = 'user-item';
    div.innerHTML = `
      <span>${userId}</span>
      <button onclick="initiateCall(window.socket, '${userId}')">Call</button>
    `;
    userList.appendChild(div);
  });
}

/**
 * Update user presence in UI
 */
function updateUserPresence(userId, status) {
  const userElement = document.querySelector(`[data-user-id="${userId}"]`);
  if (userElement) {
    userElement.className = status === 'online' ? 'online' : 'offline';
  }
}

/**
 * Show incoming call UI
 */
function showIncomingCallUI(socket, callId, callerId, callerName) {
  const incomingCallUI = document.getElementById('incoming-call-ui');
  if (!incomingCallUI) return;

  incomingCallUI.innerHTML = `
    <div class="incoming-call-container">
      <h2>📞 Incoming Call</h2>
      <p>From: ${callerName}</p>
      <button onclick="acceptCall(window.socket, '${callId}')">✅ Accept</button>
      <button onclick="rejectCall(window.socket, '${callId}')">❌ Reject</button>
    </div>
  `;
}

/**
 * Show active call UI
 */
function showCallActive() {
  const callUI = document.getElementById('call-ui');
  if (callUI) {
    callUI.style.display = 'block';
  }

  const incomingUI = document.getElementById('incoming-call-ui');
  if (incomingUI) {
    incomingUI.innerHTML = '';
  }
}

/**
 * Close call UI
 */
function closeCallUI() {
  const callUI = document.getElementById('call-ui');
  if (callUI) {
    callUI.style.display = 'none';
  }

  const localVideo = document.getElementById('local-video');
  if (localVideo) {
    localVideo.srcObject = null;
  }

  const remoteVideo = document.getElementById('remote-video');
  if (remoteVideo) {
    remoteVideo.srcObject = null;
  }
}

// ============================================================================
// SECTION 6: COMPLETE FLOW EXAMPLE
// ============================================================================

/**
 * Complete usage example
 */
async function completeFlow() {
  // 1. Register (first time only)
  // await registerUser('alice', 'password123');

  // 2. Login
  const loginResult = await loginUser('alice', 'password123');
  if (!loginResult) return;

  // 3. Connect Socket
  const socket = connectSocket();
  if (!socket) return;
  window.socket = socket;

  // Wait for connection
  socket.on('connect', async () => {
    console.log('🎉 Connected!');

    // 4. Listen for incoming calls
    listenForIncomingCalls(socket);
    listenToPresence(socket);

    // 5. Get online users
    getOnlineUsers(socket);

    // 6. Search for a user
    const searchResults = await searchUsers('bob');
    console.log('Found users:', searchResults);

    // 7. Call the user (example)
    if (searchResults.length > 0) {
      const bobId = searchResults[0]._id;
      
      // Check if online first
      socket.emit('get-online-users');
      socket.on('online-users', ({ users }) => {
        if (users.includes(bobId)) {
          console.log('✅ Bob is online, calling...');
          initiateCall(socket, bobId);
        } else {
          console.log('❌ Bob is offline');
        }
      });
    }
  });
}

// ============================================================================
// SECTION 7: ERROR HANDLING
// ============================================================================

/**
 * Common errors and solutions
 */
const ERROR_GUIDE = {
  'User is offline': 'Receiver is not connected to Socket.IO',
  'You are already in a call': 'You cannot start another call while on one',
  'User is already in a call': 'Receiver is already on a call',
  'No token': 'You must login first before connecting Socket',
  'Invalid token': 'Token expired or corrupted. Login again.',
  'Connection refused': 'Backend server is not running',
  'getUserMedia error': 'Browser denied camera/microphone access',
  'ICE connection failed': 'Network issue. May need TURN server.',
  'WebRTC offer timeout': 'Other party did not respond. Call rejected?'
};

function handleError(errorMessage) {
  console.error('Error:', errorMessage);
  const solution = ERROR_GUIDE[errorMessage] || 'Check server logs';
  console.log('💡 Solution:', solution);
}

// ============================================================================
// SECTION 8: MINIMAL HTML TEMPLATE
// ============================================================================

const MIN_HTML_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <title>WebRTC Video Calling</title>
  <style>
    body { font-family: Arial; padding: 20px; }
    video { width: 300px; height: 300px; border: 2px solid black; }
    button { padding: 10px 20px; margin: 5px; cursor: pointer; }
    .online { color: green; }
    .offline { color: red; }
  </style>
</head>
<body>
  <h1>🎥 Video Calling App</h1>

  <!-- Login -->
  <div id="login-section">
    <input type="text" id="username" placeholder="Username">
    <input type="password" id="password" placeholder="Password">
    <button onclick="handleLogin()">Login</button>
  </div>

  <!-- Main App (hidden until logged in) -->
  <div id="app-section" style="display: none;">
    <!-- Presence -->
    <h2>👥 Online Users</h2>
    <div id="online-users-list"></div>

    <!-- Search -->
    <h2>🔍 Search Users</h2>
    <input type="text" id="search-input" placeholder="Search username">
    <button onclick="handleSearch()">Search</button>

    <!-- Incoming Call -->
    <div id="incoming-call-ui"></div>

    <!-- Active Call -->
    <div id="call-ui" style="display: none;">
      <h2>📞 Active Call</h2>
      <div>
        <h3>Local Video</h3>
        <video id="local-video" autoplay muted></video>
        
        <h3>Remote Video</h3>
        <video id="remote-video" autoplay></video>
      </div>
      <button id="hangup-btn">📵 Hangup</button>
    </div>
  </div>

  <script src="https://cdn.socket.io/4.7.2/socket.io.js"></script>
  <script src="frontend-implementation.js"></script>
  <script>
    async function handleLogin() {
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;

      const result = await loginUser(username, password);
      if (result) {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('app-section').style.display = 'block';
        completeFlow();
      }
    }

    async function handleSearch() {
      const query = document.getElementById('search-input').value;
      const results = await searchUsers(query);
      console.log('Results:', results);
    }
  </script>
</body>
</html>
`;

// ============================================================================
// EXPORT FOR USE
// ============================================================================

// All functions are ready to use. Just include this file in HTML:
// <script src="frontend-implementation.js"></script>

console.log('✅ Frontend implementation loaded. Ready to use.');
