"use client";

import { FC } from 'react';
import { Phone, MapPin } from 'lucide-react';

interface Friend {
  userId: string;
  username: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen?: number;
}

interface OnlineFriendsProps {
  friends: Friend[];
  onCall?: (userId: string, username: string) => void;
  onRefresh?: () => void;
}

const OnlineFriends: FC<OnlineFriendsProps> = ({ friends, onCall, onRefresh }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'away':
        return 'bg-yellow-500';
      case 'busy':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'online':
        return '🟢';
      case 'away':
        return '🟡';
      case 'busy':
        return '🔴';
      default:
        return '⚫';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          👥 Online Friends
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
            {friends.length}
          </span>
        </h3>
        <button
          onClick={onRefresh}
          className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 hover:bg-gray-100 rounded transition-all"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {friends.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No friends online</p>
        ) : (
          friends.map((friend) => (
            <div
              key={friend.userId}
              className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-all"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {friend.username.charAt(0).toUpperCase()}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 ${getStatusColor(friend.status)} rounded-full border-2 border-white`}></div>
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-800 truncate">
                    {getStatusEmoji(friend.status)} {friend.username}
                  </p>
                  {friend.lastSeen && (
                    <p className="text-xs text-gray-500">
                      {Math.round((Date.now() - friend.lastSeen) / 60000)}m ago
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => onCall?.(friend.userId, friend.username)}
                disabled={friend.status === 'busy'}
                className={`ml-2 p-2 rounded-full transition-all flex-shrink-0 ${
                  friend.status === 'busy'
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-green-100 text-green-600 hover:bg-green-200'
                }`}
              >
                <Phone className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default OnlineFriends;
