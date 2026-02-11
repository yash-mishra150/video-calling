const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const User = require('../models/users.model.js');
const { PresenceService, PRESENCE_STATUS } = require('../services/presenceService');

const userSessions = new Map(); 
const activeCalls = new Map();

let presenceService = null; 


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


const initializeSocketHandlers = (io) => {

  presenceService = new PresenceService(io);
  
  io.use(authenticateSocket);

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    
    let username = 'Unknown';
    try {
      const user = await User.findById(userId);
      if (user) username = user.username;
    } catch (err) {
      console.log(`[SOCKET] Could not fetch user details for ${userId}`);
    }

    console.log(`[SOCKET] User ${username} (${userId}) connected: ${socket.id}`);

    userSessions.set(userId, {
      socketId: socket.id,
      callStatus: 'idle',
      connectedAt: Date.now(),
      username,
    });

    await presenceService.setOnline(userId, socket.id, username);

    
    socket.on('get-online-friends', async () => {
      const onlineFriends = await presenceService.getOnlineFriends(userId);
      socket.emit('online-friends', { friends: onlineFriends });
      console.log(`[SOCKET] User ${username} fetched ${onlineFriends.length} online friends`);
    });


    socket.on('heartbeat', () => {
      const success = presenceService.handleHeartbeat(userId);
      if (success) {
        socket.emit('heartbeat-ack');
      }
    });


    socket.on('set-status', async ({ status }) => {
      const success = await presenceService.updateStatus(userId, status);
      if (success) {
        socket.emit('status-updated', { status });
        console.log(`[PRESENCE] User ${username} status changed to ${status}`);
      } else {
        socket.emit('status-error', { message: 'Invalid status' });
      }
    });


    socket.on('get-user-presence', ({ targetUserId }) => {
      const presence = presenceService.getPresence(targetUserId);
      socket.emit('user-presence', { userId: targetUserId, ...presence });
    });


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


    socket.on('friend-request-accepted', ({ requesterId, accepterName }) => {
      presenceService.invalidateFriendCache(userId);
      presenceService.invalidateFriendCache(requesterId);

      const requester = userSessions.get(requesterId);
      if (requester) {
        io.to(requester.socketId).emit('friend-request-approved', {
          friendId: userId,
          friendName: accepterName || username
        });
        console.log(`[FRIEND] Request accepted: ${userId} accepted ${requesterId}`);
      }
    });


    socket.on('friend-removed', ({ friendId }) => {
      presenceService.invalidateFriendCache(userId);
      presenceService.invalidateFriendCache(friendId);

      const friend = userSessions.get(friendId);
      if (friend) {
        io.to(friend.socketId).emit('friend-removed-by', {
          userId: userId,
          username
        });
        console.log(`[FRIEND] Friend removed: ${username} removed ${friendId}`);
      }
    });


    socket.on('call-request', async ({ calleeId }) => {
      const caller = userSessions.get(userId);
      const calleePresence = presenceService.getPresence(calleeId);
      const callee = userSessions.get(calleeId);

      console.log(`[CALL] Request: ${userId} -> ${calleeId}`);

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

      const callId = `${userId}-${calleeId}-${Date.now()}`;
      activeCalls.set(callId, {
        callId,
        caller: userId,
        callee: calleeId,
        status: 'pending',
        createdAt: Date.now(),
      });

      caller.callStatus = 'calling';
      callee.callStatus = 'calling';
      
      await presenceService.updateStatus(userId, PRESENCE_STATUS.BUSY);
      await presenceService.updateStatus(calleeId, PRESENCE_STATUS.BUSY);

      io.to(callee.socketId).emit('incoming-call', {
        callId,
        callerId: userId,
        callerName: caller.username,
      });


      socket.emit('call-initiated', { callId });
      console.log(`[CALL] PENDING: ${callId}`);
    });


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

      callRecord.status = 'accepted';
      const callerSession = userSessions.get(callRecord.caller);
      const calleeSession = userSessions.get(callRecord.callee);

      callerSession.callStatus = 'in-call';
      calleeSession.callStatus = 'in-call';

      io.to(callerSession.socketId).emit('call-accepted', {
        callId,
        calleeId: userId,
        calleeName: calleeSession.username,
      });

      socket.emit('call-accepted', {
        callId,
        callerId: callRecord.caller,
        callerName: callerSession.username,
      });

      console.log(`[CALL] ACCEPTED: ${callId}`);
    });


    socket.on('call-reject', async ({ callId }) => {
      const callRecord = activeCalls.get(callId);

      if (!callRecord || callRecord.callee !== userId) {
        socket.emit('call-error', { message: 'Invalid call' });
        return;
      }

      const callerSession = userSessions.get(callRecord.caller);

      callerSession.callStatus = 'idle';
      userSessions.get(userId).callStatus = 'idle';
      

      await presenceService.updateStatus(callRecord.caller, PRESENCE_STATUS.ONLINE);
      await presenceService.updateStatus(userId, PRESENCE_STATUS.ONLINE);

      io.to(callerSession.socketId).emit('call-rejected', {
        callId,
        reason: 'User rejected',
      });

      activeCalls.delete(callId);
      console.log(`[CALL] REJECTED: ${callId}`);
    });


    socket.on('call-cancel', async ({ callId }) => {
      const callRecord = activeCalls.get(callId);

      if (!callRecord || callRecord.caller !== userId) {
        socket.emit('call-error', { message: 'Invalid call' });
        return;
      }

      const calleeSession = userSessions.get(callRecord.callee);


      userSessions.get(userId).callStatus = 'idle';
      calleeSession.callStatus = 'idle';
      
      await presenceService.updateStatus(userId, PRESENCE_STATUS.ONLINE);
      await presenceService.updateStatus(callRecord.callee, PRESENCE_STATUS.ONLINE);

      io.to(calleeSession.socketId).emit('call-cancelled', { callId });

      activeCalls.delete(callId);
      console.log(`[CALL] CANCELLED: ${callId}`);
    });


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

      io.to(calleeSession.socketId).emit('webrtc-offer', {
        callId,
        offer,
      });

      console.log(`[WEBRTC] Offer relayed: ${callId}`);
    });


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

      io.to(callerSession.socketId).emit('webrtc-answer', {
        callId,
        answer,
      });

      console.log(`[WEBRTC] Answer relayed: ${callId}`);
    });


    socket.on('webrtc-ice-candidate', ({ callId, candidate }) => {
      const callRecord = activeCalls.get(callId);

      if (!callRecord || callRecord.status !== 'accepted') {
        socket.emit('webrtc-error', { message: 'Call not accepted' });
        return;
      }

      const recipient =
        callRecord.caller === userId ? callRecord.callee : callRecord.caller;
      const recipientSession = userSessions.get(recipient);

      io.to(recipientSession.socketId).emit('webrtc-ice-candidate', {
        callId,
        candidate,
      });

      console.log(`[WEBRTC] ICE candidate relayed: ${callId}`);
    });


    socket.on('call-hangup', async ({ callId }) => {
      const callRecord = activeCalls.get(callId);

      if (!callRecord) {
        socket.emit('call-error', { message: 'Call not found' });
        return;
      }

      if (callRecord.caller !== userId && callRecord.callee !== userId) {
        socket.emit('call-error', { message: 'Unauthorized' });
        return;
      }

      const otherUserId =
        callRecord.caller === userId ? callRecord.callee : callRecord.caller;
      const otherSession = userSessions.get(otherUserId);

      const duration = Math.round((Date.now() - callRecord.createdAt) / 1000);

      try {
        const callerUser = await User.findById(callRecord.caller);
        const calleeUser = await User.findById(callRecord.callee);
        
        if (callerUser && calleeUser) {
          callerUser.callHistory.push({
            participantId: callRecord.callee,
            participantName: calleeUser.username,
            startTime: new Date(callRecord.createdAt),
            endTime: new Date(),
            duration: duration,
            callType: 'outgoing'
          });

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

      userSessions.get(userId).callStatus = 'idle';
      otherSession.callStatus = 'idle';
      
      await presenceService.updateStatus(userId, PRESENCE_STATUS.ONLINE);
      await presenceService.updateStatus(otherUserId, PRESENCE_STATUS.ONLINE);

      io.to(otherSession.socketId).emit('call-ended', {
        callId,
        reason: 'Other party hung up',
      });

      socket.emit('call-ended', {
        callId,
        reason: 'You hung up',
      });

      activeCalls.delete(callId);
      console.log(`[CALL] ENDED: ${callId}`);
    });


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


    socket.on('disconnect', async () => {
      console.log(`[SOCKET] User ${userId} disconnected: ${socket.id}`);

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
            await presenceService.updateStatus(otherUserId, PRESENCE_STATUS.ONLINE);
          }

          activeCalls.delete(callId);
          console.log(`[CALL] CLEANUP on disconnect: ${callId}`);
        }
      }

      userSessions.delete(userId);

      await presenceService.setOffline(userId);
      
      console.log(`[SOCKET] User ${userId} disconnected and set offline`);
    });

    
    socket.on('error', (error) => {
      console.error(`[SOCKET] Error for user ${userId}:`, error.message);
    });
  });

  process.on('SIGTERM', () => {
    if (presenceService) {
      presenceService.destroy();
    }
  });

  return presenceService;
};

module.exports = {
  initializeSocketHandlers,
  userSessions,  activeCalls,
};