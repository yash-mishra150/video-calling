"use client";

import { FC, useEffect, useState } from 'react';
import { 
  LogOut, 
  Phone, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle, 
  MapPin, 
  Search, 
  Trash2,
  Circle,
  Star
} from 'lucide-react';
import SearchBar from '@/components/SearchBar';
import OnlineFriends from '@/components/OnlineFriends';
import CallHistory from '@/components/CallHistory';
import ConsolePanel from '@/components/ConsolePanel';
import ContactList from '@/components/ContactList';
import IncomingCall from '@/components/IncomingCall';
import CallPage from '@/components/CallPage';
import { ToastContainer, ToastMessage, ToastType } from '@/components/Toast';
import { apiService } from '@/lib/api';
import { socketService } from '@/lib/socket';

interface ConsoleLog {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  timestamp: Date;
}

interface AppDashboardProps {
  username: string;
  onLogout: () => void;
}

const AppDashboard: FC<AppDashboardProps> = ({ username, onLogout }) => {
  const [status, setStatus] = useState<'online' | 'away' | 'busy' | 'offline'>('online');
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [toastCounter, setToastCounter] = useState(0);
  const [showIncomingCall, setShowIncomingCall] = useState(false);
  const [incomingCaller, setIncomingCaller] = useState('John Doe');
  const [logCounter, setLogCounter] = useState(2);
  const [friends] = useState<
    { userId: string; username: string; status: 'online' | 'away' | 'busy' | 'offline'; lastSeen?: number }[]
  >([]);

  const [callHistory] = useState<
    { id: string; participantName: string; callType: 'incoming' | 'outgoing'; startTime: string; duration: number }[]
  >([]);

  const [contacts, setContacts] = useState<{ id: string; name: string; status?: string; time?: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<{ userId: string; username: string }[]>([]);
  const [favoriteStates, setFavoriteStates] = useState<{ [key: string]: boolean }>({});
  const [incomingCallData, setIncomingCallData] = useState<{ callId: string; callerId: string; callerName: string } | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [isCallInitiator, setIsCallInitiator] = useState(true);

  const addLog = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setLogs(prev => [...prev, { id: logCounter, message, type, timestamp: new Date() }]);
    setLogCounter(prev => prev + 1);
  };

  const showToast = (message: string, type: ToastType = 'info') => {
    const id = `toast-${toastCounter}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setToastCounter(prev => prev + 1);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    addLog('Application initialized', 'info');
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const response = await apiService.getFavorites();
      let favoriteList: { userId: string; username: string }[] = [];
      
      // Handle both direct array and nested response formats
      if (response.data) {
        if (Array.isArray(response.data)) {
          favoriteList = response.data;
        } else if ((response.data as any).favorites && Array.isArray((response.data as any).favorites)) {
          favoriteList = (response.data as any).favorites;
        }
      }
      
      setFavorites(favoriteList);
      
      // Update favoriteStates for all favorites
      const newFavoriteStates: { [key: string]: boolean } = {};
      favoriteList.forEach(fav => {
        newFavoriteStates[fav.userId] = true;
      });
      setFavoriteStates(prev => ({
        ...prev,
        ...newFavoriteStates
      }));
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
  };

  useEffect(() => {
    // Get token and connect socket
    const token = localStorage.getItem('token');
    if (token) {
      socketService.connect(token);
      setupSocketListeners();
    }

    return () => {
      socketService.disconnect();
    };
  }, []);

  const setupSocketListeners = () => {
    socketService.on('incoming-call', ({ callId, callerId, callerName }: any) => {
      addLog(`Incoming call from ${callerName}`, 'info');
      setIncomingCallData({ callId, callerId, callerName });
    });

    socketService.on('call-accepted', ({ callId, calleeId, callerId }: any) => {
      addLog('Call accepted!', 'success');
      setCurrentCallId(callId);
      setIsCallActive(true);
      setIncomingCallData(null);
    });

    socketService.on('call-rejected', ({ reason }: any) => {
      addLog(`Call rejected: ${reason}`, 'error');
      showToast(`Call rejected: ${reason}`, 'error');
      setIncomingCallData(null);
    });

    socketService.on('call-ended', ({ reason }: any) => {
      addLog(`Call ended: ${reason}`, 'warning');
      showToast(`Call ended: ${reason}`, 'warning');
      setIsCallActive(false);
      setCurrentCallId(null);
      setIncomingCallData(null);
    });

    socketService.on('call-error', ({ message }: any) => {
      addLog(`Call error: ${message}`, 'error');
      showToast(`Call error: ${message}`, 'error');
      // Handle offline user error
      if (message && message.toLowerCase().includes('offline')) {
        addLog(`User is currently offline`, 'warning');
        showToast(`User is currently offline`, 'warning');
      }
    });
  };

  const handleStatusChange = (newStatus: typeof status) => {
    setStatus(newStatus);
    addLog(`Status changed to ${newStatus}`, 'success');
  };

  const handleCall = (contact: { id: string; name: string }) => {
    addLog(`Calling ${contact.name}...`, 'info');
    setIsCallInitiator(true);
    socketService.initiateCall(contact.id);
  };

  const handleCallFavorite = (userId: string, username: string) => {
    handleCall({ id: userId, name: username });
  };

  const handleCallFriend = (_userId: string, friendName: string) => {
    addLog(`Calling ${friendName}...`, 'info');
    console.log('Call initiated to:', friendName);
  };

  const handleAcceptCall = () => {
    if (incomingCallData) {
      setIsCallInitiator(false);
      socketService.acceptCall(incomingCallData.callId);
      setCurrentCallId(incomingCallData.callId);
      setIsCallActive(true);
    }
  };

  const handleRejectCall = () => {
    if (incomingCallData) {
      socketService.rejectCall(incomingCallData.callId);
      setIncomingCallData(null);
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
    setLogCounter(0);
    setTimeout(() => {
      addLog('Console cleared', 'info');
    }, 0);
  };

  const getStatusColor = (s: string) => {
    switch (s) {
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

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setContacts([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const response = await apiService.searchUsers(query.trim());

    if (response.error) {
      addLog(`Search failed: ${response.error}`, 'error');
      showToast(`Search failed: ${response.error}`, 'error');
      setContacts([]);
      setIsSearching(false);
      return;
    }

    const results = Array.isArray(response.data)
      ? response.data.map((user: any) => ({
          id: user._id || user.userId || user.id,
          name: user.username || user.name || 'Unknown',
          status: user.status,
        }))
      : [];

    setContacts(results);
    setIsSearching(false);

    // Check favorite status for each result
    results.forEach((user) => {
      checkIfFavorited(user.id);
    });
  };

  const checkIfFavorited = async (userId: string) => {
    try {
      const response = await apiService.isFavorited(userId);
      const isFav = (response.data as any)?.isFavorited || false;
      setFavoriteStates(prev => ({
        ...prev,
        [userId]: isFav
      }));
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  };

  const handleToggleFavorite = async (userId: string, username: string) => {
    try {
      const response = await apiService.toggleFavorite(userId);
      const isFav = (response.data as any)?.isFavorited || false;

      if (isFav) {
        addLog(`Added ${username} to favorites`, 'success');
      } else {
        addLog(`Removed ${username} from favorites`, 'success');
      }

      setFavoriteStates(prev => ({
        ...prev,
        [userId]: isFav
      }));

      // Reload favorites
      loadFavorites();
    } catch (error) {
      addLog('Failed to update favorite', 'error');
      showToast('Failed to update favorite', 'error');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-sm z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-800">Video Calls</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700 font-medium">{username}</span>
              <div className="relative group">
                <div className={`w-3 h-3 ${getStatusColor(status)} rounded-full cursor-pointer`}></div>
                <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg p-2 hidden group-hover:block z-50">
                  <button
                    onClick={() => handleStatusChange('online')}
                    className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${status === 'online' ? 'bg-green-100 text-green-700' : 'hover:bg-gray-100'}`}
                  >
                    <Circle className="w-3 h-3 fill-current" /> Online
                  </button>
                  <button
                    onClick={() => handleStatusChange('away')}
                    className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${status === 'away' ? 'bg-yellow-100 text-yellow-700' : 'hover:bg-gray-100'}`}
                  >
                    <Circle className="w-3 h-3 fill-current" /> Away
                  </button>
                  <button
                    onClick={() => handleStatusChange('busy')}
                    className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${status === 'busy' ? 'bg-red-100 text-red-700' : 'hover:bg-gray-100'}`}
                  >
                    <Circle className="w-3 h-3 fill-current" /> Busy
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-100 transition-all"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 pt-16 overflow-hidden">
        {/* Main Area */}
        <div className="overflow-y-auto h-full">
            <div className="p-6 flex flex-col items-center justify-start min-h-full">
              {/* Search Bar - Centered at Top */}
              <div className="w-full max-w-2xl mb-12">
                <h2 className="text-3xl font-bold text-gray-800 text-center mb-6 flex items-center justify-center gap-2">
                  <Search className="w-8 h-8" />
                  Search Users
                </h2>
                <SearchBar placeholder="Search users or dial" onSearch={handleSearch} />
                {isSearching && (
                  <p className="text-sm text-gray-500 mt-3 text-center">Searching...</p>
                )}
              </div>

              {/* Search Results or Favorites */}
              {contacts.length > 0 || searchQuery ? (
                // Show Search Results
                <div className="w-full max-w-2xl">
                  <h3 className="font-semibold text-gray-800 mb-4 text-lg flex items-center gap-2">
                    <Search className="w-5 h-5" />
                    Results for "{searchQuery}" ({contacts.length})
                  </h3>
                  {contacts.length === 0 && searchQuery && !isSearching && (
                    <div className="text-center py-8">
                      <p className="text-gray-500 text-lg">No users found for "{searchQuery}"</p>
                      <p className="text-gray-400 text-sm mt-2">Try a different search term</p>
                    </div>
                  )}
                  {contacts.length > 0 && (
                  <div className="grid gap-3">
                    {contacts.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
                      >
                        <div>
                          <p className="font-medium text-gray-800">{user.name}</p>
                          <p className="text-xs text-gray-500">ID: {user.id.substring(0, 8)}...</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCall({ id: user.id, name: user.name })}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all text-sm font-medium flex items-center gap-1"
                          >
                            <Phone className="w-4 h-4" />
                            Call
                          </button>
                          <button
                            onClick={() => handleToggleFavorite(user.id, user.name)}
                            className={`px-3 py-2 rounded-lg transition-all text-sm font-medium flex items-center gap-1 ${
                              favoriteStates[user.id]
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                            }`}
                          >
                            <Star className="w-4 h-4" />
                            {favoriteStates[user.id] ? 'Remove' : 'Add'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  )}
                </div>
              ) : (
                // Show Favorites when no search active
                <div className="w-full max-w-2xl">
                  <h3 className="font-semibold text-gray-800 mb-4 text-lg flex items-center gap-2">
                    <Star className="w-5 h-5" />
                    Favorite Contacts
                  </h3>
                  {favorites.length > 0 ? (
                    <div className="grid gap-3">
                      {favorites.map((fav) => (
                        <div
                          key={fav.userId}
                          className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
                        >
                          <div>
                            <p className="font-medium text-gray-800">
                              <Star className="w-4 h-4 inline-block mr-2 fill-yellow-400 text-yellow-400" />
                              {fav.username}
                            </p>
                            <p className="text-xs text-gray-500">ID: {fav.userId.substring(0, 8)}...</p>
                          </div>
                          <button
                            onClick={() => handleCallFavorite(fav.userId, fav.username)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all text-sm font-medium flex items-center gap-1"
                          >
                            <Phone className="w-4 h-4" />
                            Call
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-gray-500 text-lg">No favorite contacts yet</p>
                      <p className="text-gray-400 text-sm mt-2">Search for users and add them to favorites</p>
                    </div>
                  )}
                </div>
              )}
            </div>
        </div>
      </div>

      {/* Incoming Call Modal */}
      {incomingCallData && (
        <IncomingCall
          callerName={incomingCallData.callerName}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}

      {/* Call Page */}
      {isCallActive && currentCallId && (
        <CallPage callId={currentCallId} username={username} isCaller={isCallInitiator} onCallEnd={() => setIsCallActive(false)} />
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

    </div>
  );
};

export default AppDashboard;
