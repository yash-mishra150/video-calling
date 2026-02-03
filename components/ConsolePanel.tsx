"use client";

import { FC, useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

interface ConsoleLog {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  timestamp: Date;
}

interface ConsolePanelProps {
  logs: ConsoleLog[];
  onClear?: () => void;
}

const ConsolePanel: FC<ConsolePanelProps> = ({ logs, onClear }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      case 'warning':
        return 'text-yellow-400';
      case 'info':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden flex flex-col h-64">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-300">
          <Terminal className="w-4 h-4" />
          <span className="font-semibold text-sm">Console Logs</span>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 hover:bg-gray-700 rounded transition-all"
        >
          Clear
        </button>
      </div>

      {/* Logs */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-gray-950 p-4 font-mono text-xs space-y-1"
      >
        {logs.length === 0 ? (
          <div className="text-gray-500">
            <p>{'>'}  Ready for logs...</p>
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={`${log.id}-${index}`} className="flex gap-2">
              <span className="text-gray-600 shrink-0">
                [{log.timestamp.toLocaleTimeString()}]
              </span>
              <span className={getLogColor(log.type)}>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ConsolePanel;
