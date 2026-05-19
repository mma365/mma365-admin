'use client';

import { useState, useRef, useEffect } from 'react';

export const COUNTRY_FLAGS: Record<string, string> = {
  "United States": "🇺🇸", "Brazil": "🇧🇷", "Russia": "🇷🇺",
  "United Kingdom": "🇬🇧", "England": "🇬🇧", "Scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Wales": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  "Canada": "🇨🇦", "Australia": "🇦🇺", "Nigeria": "🇳🇬", "Mexico": "🇲🇽",
  "Kazakhstan": "🇰🇿", "Poland": "🇵🇱", "China": "🇨🇳", "Netherlands": "🇳🇱",
  "France": "🇫🇷", "Germany": "🇩🇪", "Ireland": "🇮🇪", "New Zealand": "🇳🇿",
  "Georgia": "🇬🇪", "Ukraine": "🇺🇦", "Czech Republic": "🇨🇿", "Sweden": "🇸🇪",
  "South Korea": "🇰🇷", "Japan": "🇯🇵", "Argentina": "🇦🇷", "Kyrgyzstan": "🇰🇬",
  "Morocco": "🇲🇦", "Bahrain": "🇧🇭", "Cuba": "🇨🇺", "Colombia": "🇨🇴",
  "Italy": "🇮🇹", "Spain": "🇪🇸", "South Africa": "🇿🇦", "Puerto Rico": "🇵🇷",
  "Dominican Republic": "🇩🇴", "Venezuela": "🇻🇪", "Lithuania": "🇱🇹",
  "Romania": "🇷🇴", "Serbia": "🇷🇸", "Croatia": "🇭🇷", "Norway": "🇳🇴",
  "Denmark": "🇩🇰", "Finland": "🇫🇮", "Portugal": "🇵🇹", "Belgium": "🇧🇪",
  "Thailand": "🇹🇭", "Philippines": "🇵🇭", "Iran": "🇮🇷", "Turkey": "🇹🇷",
  "Israel": "🇮🇱", "Mongolia": "🇲🇳", "Taiwan": "🇹🇼", "Switzerland": "🇨🇭",
  "Austria": "🇦🇹", "Bulgaria": "🇧🇬", "Latvia": "🇱🇻", "Estonia": "🇪🇪",
  "Hong Kong": "🇭🇰", "Singapore": "🇸🇬", "Malaysia": "🇲🇾", "Indonesia": "🇮🇩",
  "Vietnam": "🇻🇳", "Pakistan": "🇵🇰", "India": "🇮🇳", "Sri Lanka": "🇱🇰",
  "Bangladesh": "🇧🇩", "Nepal": "🇳🇵", "UAE": "🇦🇪", "United Arab Emirates": "🇦🇪",
  "Saudi Arabia": "🇸🇦", "Qatar": "🇶🇦", "Kuwait": "🇰🇼", "Jordan": "🇯🇴",
  "Egypt": "🇪🇬", "Tunisia": "🇹🇳", "Algeria": "🇩🇿", "Senegal": "🇸🇳",
  "Cameroon": "🇨🇲", "Ghana": "🇬🇭", "Ethiopia": "🇪🇹", "Kenya": "🇰🇪",
  "Tanzania": "🇹🇿", "Uganda": "🇺🇬", "Angola": "🇦🇴", "Zambia": "🇿🇲",
  "Zimbabwe": "🇿🇼", "Jamaica": "🇯🇲", "Trinidad and Tobago": "🇹🇹",
  "Haiti": "🇭🇹", "Panama": "🇵🇦", "Costa Rica": "🇨🇷", "Ecuador": "🇪🇨",
  "Peru": "🇵🇪", "Chile": "🇨🇱", "Bolivia": "🇧🇴", "Paraguay": "🇵🇾",
  "Uruguay": "🇺🇾", "Slovakia": "🇸🇰", "Hungary": "🇭🇺", "Slovenia": "🇸🇮",
  "Bosnia and Herzegovina": "🇧🇦", "Albania": "🇦🇱", "North Macedonia": "🇲🇰",
  "Montenegro": "🇲🇪", "Moldova": "🇲🇩", "Belarus": "🇧🇾", "Armenia": "🇦🇲",
  "Azerbaijan": "🇦🇿", "Uzbekistan": "🇺🇿", "Tajikistan": "🇹🇯",
  "Turkmenistan": "🇹🇲", "Afghanistan": "🇦🇫", "Iraq": "🇮🇶", "Syria": "🇸🇾",
  "Lebanon": "🇱🇧", "Libya": "🇱🇾", "Greece": "🇬🇷", "Cyprus": "🇨🇾",
  "Iceland": "🇮🇸", "Luxembourg": "🇱🇺", "Kosovo": "🇽🇰", "Guam": "🇬🇺",
  "Northern Ireland": "🇬🇧", "Ivory Coast": "🇨🇮", "Côte d'Ivoire": "🇨🇮",
  "Congo": "🇨🇬", "DR Congo": "🇨🇩", "Sudan": "🇸🇩", "Cambodia": "🇰🇭",
  "Myanmar": "🇲🇲", "Aruba": "🇦🇼", "Cape Verde": "🇨🇻", "Benin": "🇧🇯",
  "Burkina Faso": "🇧🇫", "Togo": "🇹🇬", "Liberia": "🇱🇷", "Papua New Guinea": "🇵🇬",
  "Rwanda": "🇷🇼", "Tonga": "🇹🇴", "Guinea": "🇬🇳", "Somalia": "🇸🇴",
  "Samoa": "🇼🇸", "Mali": "🇲🇱", "Yemen": "🇾🇪", "Palestine": "🇵🇸",
  "Mozambique": "🇲🇿", "Madagascar": "🇲🇬", "Sierra Leone": "🇸🇱",
  "South Sudan": "🇸🇸", "Gabon": "🇬🇦", "Belize": "🇧🇿",
  "Guatemala": "🇬🇹", "Honduras": "🇭🇳", "Nicaragua": "🇳🇮", "El Salvador": "🇸🇻",
  "Guyana": "🇬🇾", "Suriname": "🇸🇷",
};

// Unique sorted list for the dropdown
const COUNTRY_OPTIONS = Object.entries(COUNTRY_FLAGS)
  .filter(([name]) => !["USA", "England", "Holland", "Korea", "Czechia"].includes(name))
  .sort((a, b) => a[0].localeCompare(b[0]));

interface Props {
  value: string;
  onChange: (country: string, flag: string) => void;
  isLocked?: boolean;
}

export default function CountryPicker({ value, onChange, isLocked }: Props) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes
  useEffect(() => { setQuery(value); }, [value]);

  const filtered = query.trim()
    ? COUNTRY_OPTIONS.filter(([name]) =>
        name.toLowerCase().includes(query.toLowerCase())
      )
    : COUNTRY_OPTIONS;

  function select(name: string, flag: string) {
    setQuery(name);
    setOpen(false);
    onChange(name, flag);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlighted]) {
        select(filtered[highlighted][0], filtered[highlighted][1]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const currentFlag = COUNTRY_FLAGS[query] ?? '🏳️';

  return (
    <div ref={containerRef} className="relative">
      <div className={`flex items-center bg-gray-800 border rounded-lg overflow-hidden focus-within:border-red-500 ${
        isLocked ? 'border-yellow-800/60' : 'border-gray-700'
      }`}>
        <span className="pl-3 text-lg select-none">{currentFlag}</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlighted(0);
            onChange(e.target.value, COUNTRY_FLAGS[e.target.value] ?? '🏳️');
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-white px-3 py-2 text-sm focus:outline-none"
          autoComplete="off"
        />
      </div>

      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-56 overflow-y-auto">
          {filtered.map(([name, flag], i) => (
            <li
              key={name}
              onMouseDown={() => select(name, flag)}
              onMouseEnter={() => setHighlighted(i)}
              className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer ${
                i === highlighted ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              <span className="text-base">{flag}</span>
              <span>{name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
