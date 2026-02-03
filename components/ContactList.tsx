"use client";

import { FC, useState } from 'react';
import ContactCard from './ContactCard';

interface Contact {
  id: string;
  name: string;
  status?: string;
  time?: string;
}

interface ContactListProps {
  contacts: Contact[];
  onCall?: (contact: Contact) => void;
}

const ContactList: FC<ContactListProps> = ({ contacts, onCall }) => {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const handleToggleFavorite = (contact: Contact) => {
    setFavorites(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contact.id)) {
        newSet.delete(contact.id);
      } else {
        newSet.add(contact.id);
      }
      return newSet;
    });
  };

  return (
    <div>
      {contacts.length > 0 ? (
        <div className="max-w-2xl">
          {contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onCall={onCall}
              onToggleFavorite={handleToggleFavorite}
              isFavorited={favorites.has(contact.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg mb-2">No contacts</p>
          <p className="text-gray-500 text-sm">Your recent calls will appear here</p>
        </div>
      )}
    </div>
  );
};

export default ContactList;
