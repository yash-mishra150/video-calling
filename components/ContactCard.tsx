"use client";

import { FC, useState } from 'react';
import { Phone, Star, MoreVertical } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  status?: string;
  time?: string;
}

interface ContactCardProps {
  contact: Contact;
  onCall?: (contact: Contact) => void;
  onToggleFavorite?: (contact: Contact) => void;
  isFavorited?: boolean;
}

const ContactCard: FC<ContactCardProps> = ({ contact, onCall, onToggleFavorite, isFavorited = false }) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="flex items-center justify-between bg-gray-100 hover:bg-gray-200 rounded-lg px-4 py-3 transition-all duration-200 mb-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Avatar */}
        <div className="w-10 h-10 bg-linear-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0">
          {contact.name.charAt(0).toUpperCase()}
        </div>

        {/* Contact Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm">{contact.name}</p>
          {contact.time ? (
            <p className="text-xs text-red-600">📥 Missed call · {contact.time}</p>
          ) : (
            <p className="text-xs text-gray-500">{contact.status || 'User'}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 ml-2 shrink-0">
        <button 
          onClick={() => onCall?.(contact)}
          className="p-2 hover:bg-white hover:rounded-full transition-all"
          title="Call"
        >
          <Phone className="w-4 h-4 text-gray-600" />
        </button>

        <div className="relative">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-white hover:rounded-full transition-all"
          >
            <MoreVertical className="w-4 h-4 text-gray-600" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-10 py-1">
              <button 
                onClick={() => {
                  onToggleFavorite?.(contact);
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-700 text-sm flex items-center gap-2"
              >
                <Star className={`w-4 h-4 ${isFavorited ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                {isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              </button>
              <button className="w-full text-left px-4 py-2 hover:bg-gray-100 text-red-600 text-sm border-t">
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactCard;
