"use client";

import { FC, useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  debounceDelay?: number;
}

const SearchBar: FC<SearchBarProps> = ({
  onSearch,
  placeholder = "Search contacts or dial",
  debounceDelay = 500,
}) => {
  const [query, setQuery] = useState("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer for debounced search
    debounceTimerRef.current = setTimeout(() => {
      if (onSearch) {
        onSearch(query.trim());
      }
    }, debounceDelay);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, debounceDelay]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // Clear timer and search immediately on Enter
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (onSearch) {
        onSearch(query.trim());
      }
    }
  };

  return (
    <div className="w-full">
      <div className="bg-white rounded-full shadow-xl px-6 py-4 flex items-center gap-4 border-2 border-transparent hover:border-blue-300 transition-all duration-200">
        <Search className="text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            const nextQuery = e.target.value;
            setQuery(nextQuery);
          }}
          onKeyPress={handleKeyPress}
          className="w-full outline-none bg-transparent text-gray-700 placeholder-gray-400 text-base font-medium"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
              }
              if (onSearch) {
                onSearch("");
              }
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default SearchBar;
