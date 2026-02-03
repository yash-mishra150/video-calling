

const User = require('../models/users.model');

const PRESENCE_STATUS = {
  ONLINE: 'online',
  AWAY: 'away',
  BUSY: 'busy',
  OFFLINE: 'offline'
};

const presenceStore = new Map(); 
const friendsCache = new Map();  
const presenceQueue = new Map(); 

const HEARTBEAT_INTERVAL = 30000;    
const HEARTBEAT_TIMEOUT = 90000;     
const BATCH_INTERVAL = 5000;          
const FRIEND_CACHE_TTL = 3600000;     

class PresenceService {
  constructor(io) {
    this.io = io;
    this.batchTimer = null;
    this.cleanupTimer = null;
    this.startBatchProcessor();
    this.startCleanupTask();
  }


  async setOnline(userId, socketId, username) {
    presenceStore.set(userId, {
      status: PRESENCE_STATUS.ONLINE,
      lastSeen: Date.now(),
      socketId,
      username,
      lastHeartbeat: Date.now()
    });

    await this.notifyFriendsOfStatusChange(userId, PRESENCE_STATUS.ONLINE);
  }


  async setOffline(userId) {
    const presence = presenceStore.get(userId);
    if (!presence) return;

    presence.status = PRESENCE_STATUS.OFFLINE;
    presence.lastSeen = Date.now();
    
    setTimeout(() => {
      presenceStore.delete(userId);
    }, 300000); 

   
    await User.findByIdAndUpdate(userId, { lastSeen: new Date() }).catch(() => {});

    await this.notifyFriendsOfStatusChange(userId, PRESENCE_STATUS.OFFLINE);
  }


  async updateStatus(userId, status) {
    if (!Object.values(PRESENCE_STATUS).includes(status)) {
      return false;
    }

    const presence = presenceStore.get(userId);
    if (!presence) return false;

    presence.status = status;
    presence.lastSeen = Date.now();

    await this.notifyFriendsOfStatusChange(userId, status);
    return true;
  }

 
  handleHeartbeat(userId) {
    const presence = presenceStore.get(userId);
    if (!presence) return false;

    presence.lastHeartbeat = Date.now();
    presence.lastSeen = Date.now();

    if (presence.status === PRESENCE_STATUS.AWAY) {
      this.updateStatus(userId, PRESENCE_STATUS.ONLINE);
    }

    return true;
  }


  async getFriends(userId) {
    const cached = friendsCache.get(userId);
    

    if (cached && (Date.now() - cached.cachedAt) < FRIEND_CACHE_TTL) {
      return cached.friends;
    }

    try {
      const User = require('../models/users.model.js');
      const user = await User.findById(userId).select('friends').lean();
      
      if (!user) {
        return [];
      }

 
      const friends = user.friends.map(id => id.toString());
      

      friendsCache.set(userId, {
        friends,
        cachedAt: Date.now()
      });

      return friends;
    } catch (error) {
      console.error(`[PRESENCE] Error fetching friends for ${userId}:`, error.message);
      return [];
    }
  }


  invalidateFriendCache(userId) {
    friendsCache.delete(userId);
  }


  async getOnlineFriends(userId) {
    const friends = await this.getFriends(userId);
    const onlineFriends = [];
    const seenIds = new Set(); 

    for (const friendId of friends) {
     
      if (seenIds.has(friendId)) {
        console.warn(`[PRESENCE] Duplicate friend detected: ${friendId}`);
        continue;
      }

      const presence = presenceStore.get(friendId);
      if (presence && presence.status !== PRESENCE_STATUS.OFFLINE) {
        seenIds.add(friendId);
        onlineFriends.push({
          userId: friendId,
          username: presence.username,
          status: presence.status,
          lastSeen: presence.lastSeen
        });
      }
    }

    return onlineFriends;
  }


  getPresence(userId) {
    const presence = presenceStore.get(userId);
    if (!presence) {
      return { status: PRESENCE_STATUS.OFFLINE, lastSeen: null };
    }

    return {
      status: presence.status,
      lastSeen: presence.lastSeen,
      username: presence.username
    };
  }


  queuePresenceUpdate(userId, status) {
    presenceQueue.set(userId, {
      userId,
      status,
      timestamp: Date.now()
    });
  }


  async notifyFriendsOfStatusChange(userId, status) {
    this.queuePresenceUpdate(userId, status);
  }

 
  async getOnlineFriendSocketIds(userId) {
    const friends = await this.getFriends(userId);
    const socketIds = [];

    for (const friendId of friends) {
      const presence = presenceStore.get(friendId);
      if (presence && presence.socketId) {
        socketIds.push(presence.socketId);
      }
    }

    return socketIds;
  }

  
  startBatchProcessor() {
    this.batchTimer = setInterval(() => {
      if (presenceQueue.size === 0) return;

      const updates = Array.from(presenceQueue.values());
      presenceQueue.clear();


      const notificationMap = new Map();

      updates.forEach(update => {
        const presence = presenceStore.get(update.userId);
        if (!presence) return;

        this.getFriends(update.userId).then(friends => {
          friends.forEach(friendId => {
            if (!notificationMap.has(friendId)) {
              notificationMap.set(friendId, []);
            }
            notificationMap.get(friendId).push({
              userId: update.userId,
              username: presence.username,
              status: update.status,
              timestamp: update.timestamp
            });
          });

          notificationMap.forEach((batch, friendId) => {
            const friendPresence = presenceStore.get(friendId);
            if (friendPresence && friendPresence.socketId) {
              this.io.to(friendPresence.socketId).emit('presence-batch', {
                updates: batch
              });
            }
          });
        });
      });

      console.log(`[PRESENCE] Sent ${updates.length} batched updates`);
    }, BATCH_INTERVAL);
  }


  startCleanupTask() {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();

      for (const [userId, presence] of presenceStore.entries()) {
        if (presence.status === PRESENCE_STATUS.OFFLINE) continue;

        const timeSinceHeartbeat = now - presence.lastHeartbeat;

        if (timeSinceHeartbeat > HEARTBEAT_TIMEOUT && presence.status !== PRESENCE_STATUS.AWAY) {
          console.log(`[PRESENCE] User ${userId} is now AWAY (no heartbeat for ${Math.round(timeSinceHeartbeat / 1000)}s)`);
          this.updateStatus(userId, PRESENCE_STATUS.AWAY);
        }

        if (timeSinceHeartbeat > 600000) {
          console.log(`[PRESENCE] Removing zombie connection for ${userId}`);
          this.setOffline(userId);
        }
      }
    }, 30000); 
  }

 
  destroy() {
    if (this.batchTimer) clearInterval(this.batchTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }
}

module.exports = {
  PresenceService,
  PRESENCE_STATUS
};
