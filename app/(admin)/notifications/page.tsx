'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

type LinkType = 'none' | 'event' | 'fighter' | 'fight';

type SearchResult = { id: string; label: string; sublabel?: string };

type FightResult = { id: string; opponent: string; date: string; outcome: string | null };

type SelectedLink = { type: 'event' | 'fighter' | 'fight'; id: string; label: string };

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function NotificationsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: string; error?: string } | null>(null);

  const [linkType, setLinkType] = useState<LinkType>('none');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedLink, setSelectedLink] = useState<SelectedLink | null>(null);

  // Fight step: after selecting a fighter, show their fights
  const [selectedFighter, setSelectedFighter] = useState<SearchResult | null>(null);
  const [fights, setFights] = useState<FightResult[]>([]);
  const [loadingFights, setLoadingFights] = useState(false);

  const debouncedSearch = useDebounce(search, 300);
  const supabase = createClient();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Reset search state when link type changes
  useEffect(() => {
    setSearch('');
    setSearchResults([]);
    setShowDropdown(false);
    setSelectedLink(null);
    setSelectedFighter(null);
    setFights([]);
  }, [linkType]);

  // Search events or fighters via API route (uses admin client server-side)
  useEffect(() => {
    if (linkType === 'none') return;
    if (linkType === 'fight' && selectedFighter) return;
    if (debouncedSearch.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const searchType = linkType === 'event' ? 'event' : 'fighter';

    async function doSearch() {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(debouncedSearch.trim())}&type=${searchType}`
        );
        const data = await res.json();
        setSearchResults(data);
        setShowDropdown(true);
      } finally {
        setSearching(false);
      }
    }

    doSearch();
  }, [debouncedSearch, linkType, selectedFighter]);

  // Load fights for selected fighter
  const loadFights = useCallback(async (fighterId: string) => {
    setLoadingFights(true);
    try {
      const { data } = await supabase
        .from('fights')
        .select(`
          id,
          outcome,
          red_corner_fighter_id,
          blue_corner_fighter_id,
          events!event_id(date),
          red:fighters!red_corner_fighter_id(first_name, last_name),
          blue:fighters!blue_corner_fighter_id(first_name, last_name)
        `)
        .or(`red_corner_fighter_id.eq.${fighterId},blue_corner_fighter_id.eq.${fighterId}`)
        .order('id', { ascending: false })
        .limit(10);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: FightResult[] = (data ?? []).map((row: any) => {
        const opponentRaw = row.red_corner_fighter_id === fighterId ? row.blue : row.red;
        const opponentObj = Array.isArray(opponentRaw) ? opponentRaw[0] : opponentRaw;
        const opponent = opponentObj
          ? `${opponentObj.first_name} ${opponentObj.last_name}`
          : 'Inconnu';
        const eventsObj = Array.isArray(row.events) ? row.events[0] : row.events;
        return {
          id: row.id,
          opponent,
          date: eventsObj?.date ?? '?',
          outcome: row.outcome,
        };
      });

      setFights(results);
    } finally {
      setLoadingFights(false);
    }
  }, [supabase]);

  function selectResult(r: SearchResult) {
    setShowDropdown(false);
    setSearch('');

    if (linkType === 'event') {
      setSelectedLink({ type: 'event', id: r.id, label: r.label });
    } else if (linkType === 'fighter') {
      setSelectedLink({ type: 'fighter', id: r.id, label: r.label });
    } else if (linkType === 'fight') {
      setSelectedFighter(r);
      loadFights(r.id);
    }
  }

  function selectFight(f: FightResult) {
    setSelectedLink({
      type: 'fight',
      id: f.id,
      label: `${selectedFighter?.label} vs ${f.opponent} (${f.date})`,
    });
  }

  function clearSelection() {
    setSelectedLink(null);
    setSelectedFighter(null);
    setFights([]);
    setSearch('');
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const payload: { title: string; body: string; link?: { type: string; id: string } } = { title, body };
      if (selectedLink) {
        payload.link = { type: selectedLink.type, id: selectedLink.id };
      }

      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: `Envoyé à ${data.sent} destinataires.` });
        setTitle('');
        setBody('');
        setSelectedLink(null);
        setSelectedFighter(null);
        setFights([]);
        setLinkType('none');
      } else {
        setResult({ error: data.error ?? 'Erreur inconnue' });
      }
    } catch {
      setResult({ error: 'Erreur réseau' });
    }
    setLoading(false);
  }

  const linkTabs: { value: LinkType; label: string }[] = [
    { value: 'none', label: 'Aucun lien' },
    { value: 'event', label: '📅 Événement' },
    { value: 'fighter', label: '🥊 Combattant' },
    { value: 'fight', label: '⚔️ Combat' },
  ];

  return (
    <div>
      <h1 className="text-white text-2xl font-bold mb-6">Notifications globales</h1>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-lg">
        <form onSubmit={handleSend} className="flex flex-col gap-5">

          {/* Title */}
          <div>
            <label className="text-gray-400 text-sm block mb-1.5">Titre</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Nouvelle mise à jour"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-red-500"
              required
            />
          </div>

          {/* Body */}
          <div>
            <label className="text-gray-400 text-sm block mb-1.5">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Contenu de la notification..."
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-red-500 resize-none"
              required
            />
          </div>

          {/* Link type tabs */}
          <div>
            <label className="text-gray-400 text-sm block mb-2">Lien dans l&apos;app</label>
            <div className="flex gap-2 flex-wrap">
              {linkTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setLinkType(tab.value)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    linkType === tab.value
                      ? 'bg-red-600 border-red-600 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search section */}
          {linkType !== 'none' && (
            <div>
              {selectedLink ? (
                <div className="flex items-center justify-between bg-gray-800 border border-green-700 text-white rounded-lg px-4 py-3 text-sm">
                  <div>
                    <span className="text-green-400 text-xs font-semibold uppercase mr-2">
                      {selectedLink.type === 'event' ? 'Événement' : selectedLink.type === 'fighter' ? 'Combattant' : 'Combat'}
                    </span>
                    <span>{selectedLink.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-gray-500 hover:text-white ml-3 text-base leading-none"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <>
                  {linkType === 'fight' && selectedFighter && (
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-xs text-gray-400">Combattant :</span>
                      <span className="text-xs bg-gray-800 text-white px-2 py-1 rounded">
                        {selectedFighter.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setSelectedFighter(null); setFights([]); }}
                        className="text-gray-500 hover:text-white text-xs"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {!(linkType === 'fight' && selectedFighter) && (
                    <div className="relative" ref={dropdownRef}>
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
                        placeholder={
                          linkType === 'event'
                            ? 'Rechercher un événement...'
                            : 'Rechercher un combattant...'
                        }
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-red-500"
                      />
                      {searching && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">...</span>
                      )}

                      {showDropdown && searchResults.length > 0 && (
                        <div className="absolute z-10 top-full mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-xl">
                          {searchResults.map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => selectResult(r)}
                              className="w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors border-b border-gray-700/50 last:border-0"
                            >
                              <div className="text-white text-sm">{r.label}</div>
                              {r.sublabel && <div className="text-gray-400 text-xs mt-0.5">{r.sublabel}</div>}
                            </button>
                          ))}
                        </div>
                      )}

                      {showDropdown && !searching && searchResults.length === 0 && search.trim().length >= 2 && (
                        <div className="absolute z-10 top-full mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-500 text-sm shadow-xl">
                          Aucun résultat
                        </div>
                      )}
                    </div>
                  )}

                  {linkType === 'fight' && selectedFighter && (
                    <div className="mt-1">
                      {loadingFights ? (
                        <p className="text-gray-500 text-sm">Chargement des combats...</p>
                      ) : fights.length === 0 ? (
                        <p className="text-gray-500 text-sm">Aucun combat trouvé</p>
                      ) : (
                        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                          {fights.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => selectFight(f)}
                              className="w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors border-b border-gray-700/50 last:border-0"
                            >
                              <div className="text-white text-sm">vs {f.opponent}</div>
                              <div className="text-gray-400 text-xs mt-0.5">
                                {f.date}
                                {f.outcome && <span className="ml-2 text-gray-500">· {f.outcome}</span>}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {result?.success && <p className="text-green-400 text-sm">{result.success}</p>}
          {result?.error && <p className="text-red-400 text-sm">{result.error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Envoi en cours...' : 'Envoyer à tous les utilisateurs'}
          </button>
        </form>
      </div>
    </div>
  );
}
