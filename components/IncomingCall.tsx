"use client";

import { FC } from 'react';
import { Phone, PhoneOff } from 'lucide-react';

interface IncomingCallProps {
  callerName: string;
  onAccept: () => void;
  onReject: () => void;
}

const IncomingCall: FC<IncomingCallProps> = ({ callerName, onAccept, onReject }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gradient-to-br from-blue-600 to-purple-700 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center text-white">
        <div className="mb-6">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <span className="text-4xl">👤</span>
          </div>
          <h2 className="text-3xl font-bold">Incoming Call</h2>
          <p className="text-blue-100 text-lg mt-2">From <strong>{callerName}</strong></p>
        </div>

        {/* Caller Info */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-8 border border-white/20">
          <p className="text-sm text-blue-100">📞 {callerName}</p>
        </div>

        {/* Buttons */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={onReject}
            className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-8 py-3 rounded-full transition-all transform hover:scale-105"
          >
            <PhoneOff className="w-5 h-5" />
            Reject
          </button>
          <button
            onClick={onAccept}
            className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-3 rounded-full transition-all transform hover:scale-105"
          >
            <Phone className="w-5 h-5" />
            Accept
          </button>
        </div>

        {/* Ringing animation */}
        <style>{`
          @keyframes ring {
            0%, 100% { transform: scale(1); }
            25% { transform: scale(1.05); }
            75% { transform: scale(1.05); }
          }
          .ring-animation {
            animation: ring 1s infinite;
          }
        `}</style>
        <div className="mt-6 text-blue-100 text-sm">
          <div className="inline-block px-3 py-1 bg-white/20 rounded-full ring-animation">
            📳 Ringing...
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCall;
