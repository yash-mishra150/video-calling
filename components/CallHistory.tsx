"use client";

import { FC } from 'react';
import { Trash2, RefreshCw } from 'lucide-react';

interface CallRecord {
  id: string;
  participantName: string;
  callType: 'incoming' | 'outgoing';
  startTime: string;
  duration: number;
}

interface CallHistoryProps {
  calls: CallRecord[];
  onRefresh?: () => void;
  onClear?: () => void;
}

const CallHistory: FC<CallHistoryProps> = ({ calls, onRefresh, onClear }) => {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getCallTypeEmoji = (type: string) => {
    return type === 'incoming' ? '📥' : '📤';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          📋 Call History
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
            {calls.length}
          </span>
        </h3>
        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 hover:bg-gray-100 rounded transition-all flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
          <button
            onClick={onClear}
            className="text-xs text-red-600 hover:text-red-800 px-2 py-1 hover:bg-red-50 rounded transition-all flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> Clear
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {calls.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No call history</p>
        ) : (
          calls.map((call) => (
            <div
              key={call.id}
              className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-all border border-gray-100"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-800">
                  {getCallTypeEmoji(call.callType)} {call.participantName}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(call.startTime).toLocaleString()}
                </p>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <p className="font-semibold text-blue-600 text-sm">
                  {formatDuration(call.duration)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CallHistory;
