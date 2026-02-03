# Friend Request System - Implementation Complete! ✅

## What Changed

Your app now has a **proper friend request system** like Facebook/Instagram:

### Before (Instant Contacts)
```
User A → Add Contact → User B is instantly a friend ❌
```

### Now (Friend Requests)
```
User A → Send Request → User B → Accept → Friends ✅
```

---

## Key Features Implemented

### 1. **Backend Changes**

#### Updated Database Schema
- **Old:** `{ owner, contact }`
- **New:** `{ requester, recipient, status: 'pending'|'accepted'|'rejected' }`

#### New API Endpoints
- `POST /api/contacts/send-request` - Send friend request
- `POST /api/contacts/accept-request` - Accept request
- `POST /api/contacts/reject-request` - Reject request
- `GET /api/contacts/pending-requests` - Get incoming requests
- `GET /api/contacts/friends` - Get accepted friends only
- `POST /api/contacts/remove-friend` - Remove a friend

#### Socket.IO Events
- `friend-request-received` - Notify when someone sends you a request
- `friend-request-approved` - Notify when your request is accepted
- `friend-removed-by` - Notify when someone removes you

#### Presence System Updated
- **Only accepted friends** see each other online
- Checks **both directions** (requester/recipient)
- Friend cache invalidated on status changes

---

## Files Modified

### Core Backend Files
1. ✅ [src/models/contact.model.js](src/models/contact.model.js) - New schema with status field
2. ✅ [src/controllers/contact.controller.js](src/controllers/contact.controller.js) - Friend request logic
3. ✅ [src/routes/contact.routes.js](src/routes/contact.routes.js) - New routes
4. ✅ [src/services/presenceService.js](src/services/presenceService.js) - Filter by accepted friends
5. ✅ [src/socket/socketHandler.js](src/socket/socketHandler.js) - Real-time notifications
6. ✅ [src/middleware/validation.middleware.js](src/middleware/validation.middleware.js) - Support both field names

### Documentation & Scripts
7. ✅ [FRIEND_REQUEST_SYSTEM.md](FRIEND_REQUEST_SYSTEM.md) - Complete documentation
8. ✅ [migrate-to-friend-requests.js](migrate-to-friend-requests.js) - Migration script

---

## Migration Required! ⚠️

If you have existing contacts in your database, run this **one-time migration**:

```bash
node migrate-to-friend-requests.js
```

**What it does:**
- Converts old `owner/contact` to `requester/recipient`
- Sets all existing contacts to `status: 'accepted'`
- Removes duplicate relationships
- Safe to run multiple times

**Example output:**
```
✅ Connected to MongoDB
📊 Starting migration...
Found 10 contacts in OLD schema format
✅ Converted: 507f...011 -> 507f...012 (status: accepted)
🗑️  Deleted 10 old contact records
✅ Inserted 7 new friend relationships
🎉 Migration completed successfully!
```

---

## How It Works Now

### Step 1: User A Sends Request
```javascript
// POST /api/contacts/send-request
{
  "recipientId": "USER_B_ID"
}

// Response:
{
  "message": "Friend request sent",
  "recipientName": "Bob"
}
```

### Step 2: User B Gets Notification
```javascript
// Socket event received by User B
socket.on('friend-request-received', ({ requesterId, requesterName }) => {
  console.log(`${requesterName} sent you a friend request`);
  // Show notification in UI
});
```

### Step 3: User B Views Pending Requests
```javascript
// GET /api/contacts/pending-requests

// Response:
{
  "requests": [
    {
      "requestId": "507f...",
      "requesterId": "USER_A_ID",
      "requesterName": "Alice",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ]
}
```

### Step 4: User B Accepts Request
```javascript
// POST /api/contacts/accept-request
{
  "requestId": "507f..."
}

// Response:
{
  "message": "Friend request accepted",
  "friendName": "Alice"
}
```

### Step 5: User A Gets Notification
```javascript
// Socket event received by User A
socket.on('friend-request-approved', ({ friendId, friendName }) => {
  console.log(`${friendName} accepted your friend request`);
  // Update friends list
});
```

### Step 6: Both See Each Other Online
```javascript
// Online presence now shows only ACCEPTED friends
socket.emit('get-online-friends');

// Response includes both users if they're online
{
  "friends": [
    {
      "userId": "USER_B_ID",
      "username": "Bob",
      "status": "online"
    }
  ]
}
```

---

## Frontend Update Needed 🎨

Your [index.html](index.html) currently has an "Add Contact" button that sends instant contact requests. Update it to:

### Replace "Add Contact" Section

**Current (Instant Add):**
```html
<input id="contactId" placeholder="User ID">
<button onclick="addContact()">Add Contact</button>
```

**Update To (Friend Request):**
```html
<input id="recipientId" placeholder="User ID">
<button onclick="sendFriendRequest()">Send Friend Request</button>

<!-- New: Pending Requests Section -->
<div id="pending-requests">
  <h3>Friend Requests</h3>
  <div id="requests-list"></div>
</div>
```

### Add JavaScript Functions

```javascript
// Send friend request
async function sendFriendRequest() {
  const recipientId = document.getElementById('recipientId').value;
  const token = localStorage.getItem('token');
  
  const response = await fetch('http://localhost:5000/api/contacts/send-request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ recipientId })
  });

  const data = await response.json();
  
  if (response.ok) {
    socket.emit('friend-request-sent', {
      recipientId,
      requesterName: currentUser.username
    });
    alert(`Friend request sent to ${data.recipientName}`);
  } else {
    alert(data.message);
  }
}

// Load pending requests
async function loadPendingRequests() {
  const token = localStorage.getItem('token');
  
  const response = await fetch('http://localhost:5000/api/contacts/pending-requests', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const data = await response.json();
  const list = document.getElementById('requests-list');
  list.innerHTML = '';
  
  data.requests.forEach(req => {
    const div = document.createElement('div');
    div.innerHTML = `
      <span>${req.requesterName}</span>
      <button onclick="acceptRequest('${req.requestId}', '${req.requesterId}')">Accept</button>
      <button onclick="rejectRequest('${req.requestId}')">Reject</button>
    `;
    list.appendChild(div);
  });
}

// Accept request
async function acceptRequest(requestId, requesterId) {
  const token = localStorage.getItem('token');
  
  const response = await fetch('http://localhost:5000/api/contacts/accept-request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ requestId })
  });

  const data = await response.json();
  
  if (response.ok) {
    socket.emit('friend-request-accepted', {
      requesterId,
      accepterName: currentUser.username
    });
    alert(`You are now friends with ${data.friendName}`);
    loadPendingRequests(); // Refresh list
    socket.emit('get-online-friends'); // Refresh online friends
  }
}

// Reject request
async function rejectRequest(requestId) {
  const token = localStorage.getItem('token');
  
  await fetch('http://localhost:5000/api/contacts/reject-request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ requestId })
  });

  alert('Friend request rejected');
  loadPendingRequests(); // Refresh list
}

// Listen for notifications
socket.on('friend-request-received', ({ requesterId, requesterName }) => {
  alert(`${requesterName} sent you a friend request`);
  loadPendingRequests(); // Refresh pending list
});

socket.on('friend-request-approved', ({ friendId, friendName }) => {
  alert(`${friendName} accepted your friend request`);
  socket.emit('get-online-friends'); // Refresh online friends
});
```

---

## Testing Steps

### 1. Run Migration (If Needed)
```bash
node migrate-to-friend-requests.js
```

### 2. Start Server (Already Running)
```bash
# Your server is already running on port 5000
# Check terminal output for any errors
```

### 3. Test With Two Users

**Terminal 1 (User A):**
```bash
# Login and get token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user_a", "password": "password123"}'
```

**Terminal 2 (User B):**
```bash
# Login and get token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user_b", "password": "password123"}'
```

**User A sends request:**
```bash
curl -X POST http://localhost:5000/api/contacts/send-request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_A_TOKEN>" \
  -d '{"recipientId": "<USER_B_ID>"}'
```

**User B checks pending:**
```bash
curl http://localhost:5000/api/contacts/pending-requests \
  -H "Authorization: Bearer <USER_B_TOKEN>"
```

**User B accepts:**
```bash
curl -X POST http://localhost:5000/api/contacts/accept-request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_B_TOKEN>" \
  -d '{"requestId": "<REQUEST_ID>"}'
```

**Check online friends (both should see each other):**
```bash
# Connect via Socket.IO and emit 'get-online-friends'
```

---

## Benefits of New System

### ✅ Privacy Control
- Users must accept before becoming friends
- No instant adding without permission

### ✅ Better UX
- Clear friend request notifications
- Pending/accepted/rejected states
- Remove friend option

### ✅ Production-Ready
- Bidirectional relationships handled
- No duplicate friends
- Proper database indexes
- Cache invalidation

### ✅ Scalable
- Friend cache (1 hour TTL)
- Batched presence updates (5s)
- Efficient DB queries
- Socket.IO real-time notifications

---

## What's Still The Same

✅ Heartbeat system (30s intervals)  
✅ Presence tracking (online/away/busy/offline)  
✅ WebRTC call flow  
✅ P2P video/audio (still instant, 100-500ms)  
✅ Socket.IO authentication  
✅ JWT token system  

---

## Next Steps

1. **Run migration** if you have existing data
2. **Update frontend UI** with friend request buttons
3. **Test** with two users
4. **Deploy** when ready

---

## Documentation

- **Full API Reference:** [FRIEND_REQUEST_SYSTEM.md](FRIEND_REQUEST_SYSTEM.md)
- **Migration Script:** [migrate-to-friend-requests.js](migrate-to-friend-requests.js)
- **Quick Start:** [00_START_HERE.md](00_START_HERE.md)

---

## Questions?

**Q: Will my existing contacts still work?**  
A: Yes! Run the migration script to convert them to "accepted" friends.

**Q: Can I still use the old `/api/contacts/add` endpoint?**  
A: Yes, it redirects to `/send-request` for backward compatibility.

**Q: Do pending requests show in online friends?**  
A: No, only accepted friends see each other online.

**Q: How long do pending requests last?**  
A: Forever (until accepted/rejected). You can add expiration later.

**Q: Can I block users?**  
A: Not yet, but easy to add (see FRIEND_REQUEST_SYSTEM.md for enhancement ideas).

---

**Status:** ✅ **READY TO USE**  
**Backend:** Complete and tested  
**Frontend:** Needs UI update (see above)  
**Migration:** Run `node migrate-to-friend-requests.js`

---

Enjoy your proper friend system! 🎉
