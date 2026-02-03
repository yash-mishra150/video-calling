/**
 * Socket.IO Handler for Presence, Call Signaling, and WebRTC Media
 * 
 * Features:
 * - Production-grade presence tracking (online/away/busy/offline)
 * - Heartbeat-based connection monitoring
 * - Batched presence updates
 * - Friend list caching
 * - Call request/accept/reject flow
 * - WebRTC offer/answer signaling
 * - ICE candidate relay
 * - Call cleanup on disconnect
 * - Prevent simultaneous calls
 */

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const User = require('../models/users.model.js');
const { PresenceService, PRESENCE_STATUS } = require('../services/presenceService');

// In-memory data stores
const userSessions = new Map(); // userId -> { socketId, callStatus: 'idle'|'calling'|'in-call', username }
const activeCalls = new Map(); // callId -> { caller, callee, status: 'pending'|'accepted'|'active' }

let presenceService = null; // Initialized in initializeSocketHandlers

/**
 * Authenticate socket connection via JWT token
 */
const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: No token'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid token'));
  }
};

/**
 * Initialize Socket.IO event handlers
 */
const initializeSocketHandlers = (io) => {
  // Initialize presence service
  presenceService = new PresenceService(io);
  
  io.use(authenticateSocket);

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    
    // Fetch user details
    let username = 'Unknown';
    try {
      const user = await User.findById(userId);
      if (user) username = user.username;
    } catch (err) {
      console.log(`[SOCKET] Could not fetch user details for ${userId}`);
    }

    console.log(`[SOCKET] User ${username} (${userId}) connected: ${socket.id}`);

    // Register user session
    userSessions.set(userId, {
      socketId: socket.id,
      callStatus: 'idle', // idle, calling, in-call
      connectedAt: Date.now(),
      username,
    });

    // Set user as online in presence service
    await presenceService.setOnline(userId, socket.id, username);

    // ==================== PRESENCE EVENTS ====================
    
    /**
     * Get list of online friends with their status
     */
    socket.on('get-online-friends', async () => {
      const onlineFriends = await presenceService.getOnlineFriends(userId);
      socket.emit('online-friends', { friends: onlineFriends });
      console.log(`[SOCKET] User ${username} fetched ${onlineFriends.length} online friends`);
    });

    /**
     * Heartbeat - client sends every 30s to keep connection alive
     */
    socket.on('heartbeat', () => {
      const success = presenceService.handleHeartbeat(userId);
      if (success) {
        socket.emit('heartbeat-ack');
      }
    });

    /**
     * Update user status (online, away, busy)
     */
    socket.on('set-status', async ({ status }) => {
      const success = await presenceService.updateStatus(userId, status);
      if (success) {
        socket.emit('status-updated', { status });
        console.log(`[PRESENCE] User ${username} status changed to ${status}`);
      } else {
        socket.emit('status-error', { message: 'Invalid status' });
      }
    });

    /**
     * Get presence info for a specific user
     */
    socket.on('get-user-presence', ({ targetUserId }) => {
      const presence = presenceService.getPresence(targetUserId);
      socket.emit('user-presence', { userId: targetUserId, ...presence });
    });

    // ==================== FRIEND REQUEST EVENTS ====================

    /**
     * Notify user about new friend request received
     * Called from contact controller after friend request is sent
     */
    socket.on('friend-request-sent', ({ recipientId, requesterName }) => {
      const recipient = userSessions.get(recipientId);
      if (recipient) {
        io.to(recipient.socketId).emit('friend-request-received', {
          requesterId: userId,
          requesterName: requesterName || username
        });
        console.log(`[FRIEND] Request sent: ${username} -> ${recipientId}`);
      }
    });

    /**
     * Notify requester about friend request acceptance
     * Called from contact controller after acceptance
     */
    socket.on('friend-request-accepted', ({ requesterId, accepterName }) => {
      // Invalidate both users' friend cache
      presenceService.invalidateFriendCache(userId);
      presenceService.invalidateFriendCache(requesterId);

      // Notify the original requester
      const requester = userSessions.get(requesterId);
      if (requester) {
        io.to(requester.socketId).emit('friend-request-approved', {
          friendId: userId,
          friendName: accepterName || username
        });
        console.log(`[FRIEND] Request accepted: ${userId} accepted ${requesterId}`);
      }
    });

    /**
     * Notify both parties about friend removal
     */
    socket.on('friend-removed', ({ friendId }) => {
      // Invalidate both users' friend cache
      presenceService.invalidateFriendCache(userId);
      presenceService.invalidateFriendCache(friendId);

      // Notify the removed friend
      const friend = userSessions.get(friendId);
      if (friend) {
        io.to(friend.socketId).emit('friend-removed-by', {
          userId: userId,
          username
        });
        console.log(`[FRIEND] Friend removed: ${username} removed ${friendId}`);
      }
    });

    // ==================== CALL EVENTS ====================

    /**
     * Call request: caller sends intent to callee
     * Only allowed if:
     * 1. Callee is online
     * 2. Caller is idle (not in another call)
     * 3. Callee is idle (not in another call)
     */
    socket.on('call-request', async ({ calleeId }) => {
      const caller = userSessions.get(userId);
      const calleePresence = presenceService.getPresence(calleeId);
      const callee = userSessions.get(calleeId);

      console.log(`[CALL] Request: ${userId} -> ${calleeId}`);

      // Validation
      if (!calleeId) {
        socket.emit('call-error', { message: 'Invalid callee' });
        return;
      }

      if (!callee || calleePresence.status === PRESENCE_STATUS.OFFLINE) {
        socket.emit('call-error', { message: 'User is offline' });
        console.log(`[CALL] REJECTED: ${calleeId} is offline`);
        return;
      }

      if (caller.callStatus !== 'idle') {
        socket.emit('call-error', { message: 'You are already in a call' });
        console.log(`[CALL] REJECTED: Caller ${userId} not idle (status: ${caller.callStatus})`);
        return;
      }

      if (callee.callStatus !== 'idle') {
        socket.emit('call-error', { message: 'User is already in a call' });
        console.log(`[CALL] REJECTED: Callee ${calleeId} not idle (status: ${callee.callStatus})`);
        return;
      }

      // Create call record
      const callId = `${userId}-${calleeId}-${Date.now()}`;
      activeCalls.set(callId, {
        callId,
        caller: userId,
        callee: calleeId,
        status: 'pending',
        createdAt: Date.now(),
      });

      // Update call statuses
      caller.callStatus = 'calling';
      callee.callStatus = 'calling';
      
      // Set presence to busy
      await presenceService.updateStatus(userId, PRESENCE_STATUS.BUSY);
      await presenceService.updateStatus(calleeId, PRESENCE_STATUS.BUSY);

      // Send request to callee
      io.to(callee.socketId).emit('incoming-call', {
        callId,
        callerId: userId,
        callerName: userId, // In production, fetch from DB
      });

      // Send confirmation to caller
      socket.emit('call-initiated', { callId });
      console.log(`[CALL] PENDING: ${callId}`);
    });

    /**
     * Call accept: callee accepts incoming call
     */
    socket.on('call-accept', ({ callId }) => {
      const callRecord = activeCalls.get(callId);

      if (!callRecord) {
        socket.emit('call-error', { message: 'Call not found' });
        return;
      }

      if (callRecord.callee !== userId) {
        socket.emit('call-error', { message: 'Unauthorized' });
        return;
      }

      // Update call status
      callRecord.status = 'accepted';
      const callerSession = userSessions.get(callRecord.caller);
      const calleeSession = userSessions.get(callRecord.callee);

      callerSession.callStatus = 'in-call';
      calleeSession.callStatus = 'in-call';

      // Notify both parties - WebRTC signaling can now start
      io.to(callerSession.socketId).emit('call-accepted', {
        callId,
        calleeId: userId,
      });

      socket.emit('call-accepted', {
        callId,
        callerId: callRecord.caller,
      });

      console.log(`[CALL] ACCEPTED: ${callId}`);
    });

    /**
     * Call reject: callee rejects incoming call
     */
    socket.on('call-reject', async ({ callId }) => {
      const callRecord = activeCalls.get(callId);

      if (!callRecord || callRecord.callee !== userId) {
        socket.emit('call-error', { message: 'Invalid call' });
        return;
      }

      const callerSession = userSessions.get(callRecord.caller);

      // Reset call statuses to idle
      callerSession.callStatus = 'idle';
      userSessions.get(userId).callStatus = 'idle';
      
      // Reset presence to online
      await presenceService.updateStatus(callRecord.caller, PRESENCE_STATUS.ONLINE);
      await presenceService.updateStatus(userId, PRESENCE_STATUS.ONLINE);

      // Notify caller
      io.to(callerSession.socketId).emit('call-rejected', {
        callId,
        reason: 'User rejected',
      });

      activeCalls.delete(callId);
      console.log(`[CALL] REJECTED: ${callId}`);
    });

    /**
     * Call timeout/cancel: caller cancels pending call (before accept/reject)
     */
    socket.on('call-cancel', async ({ callId }) => {
      const callRecord = activeCalls.get(callId);

      if (!callRecord || callRecord.caller !== userId) {
        socket.emit('call-error', { message: 'Invalid call' });
        return;
      }

      const calleeSession = userSessions.get(callRecord.callee);

      // Reset call statuses
      userSessions.get(userId).callStatus = 'idle';
      calleeSession.callStatus = 'idle';
      
      // Reset presence to online
      await presenceService.updateStatus(userId, PRESENCE_STATUS.ONLINE);
      await presenceService.updateStatus(callRecord.callee, PRESENCE_STATUS.ONLINE);

      // Notify callee
      io.to(calleeSession.socketId).emit('call-cancelled', { callId });

      activeCalls.delete(callId);
      console.log(`[CALL] CANCELLED: ${callId}`);
    });

    // ==================== WEBRTC SIGNALING ====================

    /**
     * SDP offer: caller sends WebRTC offer to callee
     * Must only work after call is accepted
     */
    socket.on('webrtc-offer', ({ callId, offer }) => {
      const callRecord = activeCalls.get(callId);

      if (!callRecord || callRecord.status !== 'accepted') {
        socket.emit('webrtc-error', { message: 'Call not accepted' });
        return;
      }

      if (callRecord.caller !== userId) {
        socket.emit('webrtc-error', { message: 'Only caller sends offer' });
        return;
      }

      const calleeSession = userSessions.get(callRecord.callee);

      // Relay SDP offer to callee
      io.to(calleeSession.socketId).emit('webrtc-offer', {
        callId,
        offer,
      });

      console.log(`[WEBRTC] Offer relayed: ${callId}`);
    });

    /**
     * SDP answer: callee sends WebRTC answer to caller
     * Must only work after call is accepted
     */
    socket.on('webrtc-answer', ({ callId, answer }) => {
      const callRecord = activeCalls.get(callId);

      if (!callRecord || callRecord.status !== 'accepted') {
        socket.emit('webrtc-error', { message: 'Call not accepted' });
        return;
      }

      if (callRecord.callee !== userId) {
        socket.emit('webrtc-error', { message: 'Only callee sends answer' });
        return;
      }

      const callerSession = userSessions.get(callRecord.caller);

      // Relay SDP answer to caller
      io.to(callerSession.socketId).emit('webrtc-answer', {
        callId,
        answer,
      });

      console.log(`[WEBRTC] Answer relayed: ${callId}`);
    });

    /**
     * ICE candidate: relay candidates for both directions
     */
    socket.on('webrtc-ice-candidate', ({ callId, candidate }) => {
      const callRecord = activeCalls.get(callId);

      if (!callRecord || callRecord.status !== 'accepted') {
        socket.emit('webrtc-error', { message: 'Call not accepted' });
        return;
      }

      // Determine recipient (the other party)
      const recipient =
        callRecord.caller === userId ? callRecord.callee : callRecord.caller;
      const recipientSession = userSessions.get(recipient);

      // Relay ICE candidate
      io.to(recipientSession.socketId).emit('webrtc-ice-candidate', {
        callId,
        candidate,
      });

      console.log(`[WEBRTC] ICE candidate relayed: ${callId}`);
    });

    // ==================== CALL TERMINATION ====================

    /**
     * Call hangup: either party ends the call
     */
    socket.on('call-hangup', async ({ callId }) => {
      const callRecord = activeCalls.get(callId);

      if (!callRecord) {
        socket.emit('call-error', { message: 'Call not found' });
        return;
      }

      // Verify user is part of this call
      if (callRecord.caller !== userId && callRecord.callee !== userId) {
        socket.emit('call-error', { message: 'Unauthorized' });
        return;
      }

      const otherUserId =
        callRecord.caller === userId ? callRecord.callee : callRecord.caller;
      const otherSession = userSessions.get(otherUserId);

      // Calculate call duration
      const duration = Math.round((Date.now() - callRecord.createdAt) / 1000);

      // Save call history for both users
      try {
        const callerUser = await User.findById(callRecord.caller);
        const calleeUser = await User.findById(callRecord.callee);
        
        if (callerUser && calleeUser) {
          // Add to caller's history (outgoing)
          callerUser.callHistory.push({
            participantId: callRecord.callee,
            participantName: calleeUser.username,
            startTime: new Date(callRecord.createdAt),
            endTime: new Date(),
            duration: duration,
            callType: 'outgoing'
          });

          // Add to callee's history (incoming)
          calleeUser.callHistory.push({
            participantId: callRecord.caller,
            participantName: callerUser.username,
            startTime: new Date(callRecord.createdAt),
            endTime: new Date(),
            duration: duration,
            callType: 'incoming'
          });

          await callerUser.save();
          await calleeUser.save();
          
          console.log(`[CALL HISTORY] Logged call: ${callRecord.caller} <-> ${callRecord.callee} (${duration}s)`);
        }
      } catch (err) {
        console.log(`[CALL HISTORY] Error saving call history: ${err.message}`);
      }

      // Reset both statuses to idle
      userSessions.get(userId).callStatus = 'idle';
      otherSession.callStatus = 'idle';
      
      // Reset presence to online
      await presenceService.updateStatus(userId, PRESENCE_STATUS.ONLINE);
      await presenceService.updateStatus(otherUserId, PRESENCE_STATUS.ONLINE);

      // Notify other party
      io.to(otherSession.socketId).emit('call-ended', {
        callId,
        reason: 'Other party hung up',
      });

      // Notify self
      socket.emit('call-ended', {
        callId,
        reason: 'You hung up',
      });

      activeCalls.delete(callId);
      console.log(`[CALL] ENDED: ${callId}`);
    });

    // ==================== MEDIA CONTROLS ====================

    /**
     * Handle mic toggle - notify other party
     */
    socket.on('mic-toggled', ({ callId, enabled }) => {
      const callRecord = activeCalls.get(callId);
      if (!callRecord) return;

      const otherUserId =
        callRecord.caller === userId ? callRecord.callee : callRecord.caller;
      const otherSession = userSessions.get(otherUserId);

      if (otherSession) {
        io.to(otherSession.socketId).emit('remote-mic-toggled', {
          callId,
          enabled,
          userId,
        });
      }
      console.log(`[MEDIA] User ${userId} mic ${enabled ? 'ON' : 'OFF'}`);
    });

    /**
     * Handle camera toggle - notify other party
     */
    socket.on('camera-toggled', ({ callId, enabled }) => {
      const callRecord = activeCalls.get(callId);
      if (!callRecord) return;

      const otherUserId =
        callRecord.caller === userId ? callRecord.callee : callRecord.caller;
      const otherSession = userSessions.get(otherUserId);

      if (otherSession) {
        io.to(otherSession.socketId).emit('remote-camera-toggled', {
          callId,
          enabled,
          userId,
        });
      }
      console.log(`[MEDIA] User ${userId} camera ${enabled ? 'ON' : 'OFF'}`);
    });

    // ==================== DISCONNECT ====================

    socket.on('disconnect', async () => {
      console.log(`[SOCKET] User ${userId} disconnected: ${socket.id}`);

      // Find and cleanup any active calls
      for (const [callId, callRecord] of activeCalls.entries()) {
        if (callRecord.caller === userId || callRecord.callee === userId) {
          const otherUserId =
            callRecord.caller === userId
              ? callRecord.callee
              : callRecord.caller;
          const otherSession = userSessions.get(otherUserId);

          if (otherSession) {
            otherSession.callStatus = 'idle';
            io.to(otherSession.socketId).emit('call-ended', {
              callId,
              reason: 'Other party disconnected',
            });
            // Reset presence to online
            await presenceService.updateStatus(otherUserId, PRESENCE_STATUS.ONLINE);
          }

          activeCalls.delete(callId);
          console.log(`[CALL] CLEANUP on disconnect: ${callId}`);
        }
      }

      // Remove user session
      userSessions.delete(userId);

      // Set user offline in presence service
      await presenceService.setOffline(userId);
      
      console.log(`[SOCKET] User ${userId} disconnected and set offline`);
    });

    // ==================== ERROR HANDLING ====================
    
    socket.on('error', (error) => {
      console.error(`[SOCKET] Error for user ${userId}:`, error.message);
    });
  });

  // Cleanup on server shutdown
  process.on('SIGTERM', () => {
    if (presenceService) {
      presenceService.destroy();
    }
  });

  // Return presenceService so it can be used by controllers
  return presenceService;
};

module.exports = {
  initializeSocketHandlers,
  userSessions,  activeCalls,
};