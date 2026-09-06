'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type ArticleType = 'preview' | 'focus' | 'portrait';
type Option = { id: string; label: string; sublabel?: string };

const TYPES: { value: ArticleType; label: string; description: string; subject: string }[] = [
  { value: 'preview', label: '🔮 Preview d\'event', description: 'Pourquoi cet event vaut le coup, les combats à suivre', subject: 'un event' },
  { value: 'focus', label: '🥊 Focus combat', description: 'Un seul combat raconté en profondeur', subject: 'un combat' },
  { value: 'portrait', label: '👤 Portrait de fighter', description: 'La trajectoire d\'un fighter', subject: 'un fighter' },
];

function SubjectSearch({
  type,
  onSelect,
  selected,
}: {
  type: ArticleType;
  onSelect: (opt: Option | null) => void;
  selected: Option | null;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Option[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchType = type === 'portrait' ? 'fighter' : 'event';

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?type=${searchType}&q=${encodeURIComponent(query)}`);
        setResults(await res.json());
      } finally {
        setSearching(false);
      }
    }, 250);
  }, [query, searchType]);

  if (selected) {
    return (
      <div className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
        <div>
          <span className="text-white text-sm">{selected.label}</span>
          {selected.sublabel && <span className="text-gray-500 text-xs ml-2">{selected.sublabel}</span>}
        </div>
        <button onClick={() => onSelect(null)} className="text-gray-500 hover:text-white text-xs">
          Changer
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Rechercher ${searchType === 'event' ? 'un event' : 'un fighter'}...`}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500"
      />
      {(results.length > 0 || searching) && (
        <div className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
          {searching && <div className="px-3 py-2 text-gray-500 text-sm">Recherche...</div>}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelect(r)}
              className="w-full text-left px-3 py-2 hover:bg-gray-700 transition-colors"
            >
              <span className="text-white text-sm">{r.label}</span>
              {r.sublabel && <span className="text-gray-500 text-xs ml-2">{r.sublabel}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NewArticleForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const prefillType = searchParams.get('type') as ArticleType | null;
  const prefillEventId = searchParams.get('eventId');
  const prefillEventLabel = searchParams.get('eventLabel');

  const [type, setType] = useState<ArticleType>(prefillType && ['preview', 'focus', 'portrait'].includes(prefillType) ? prefillType : 'preview');
  const [subject, setSubject] = useState<Option | null>(
    prefillEventId ? { id: prefillEventId, label: prefillEventLabel ?? prefillEventId } : null
  );
  const [fights, setFights] = useState<Option[]>([]);
  const [selectedFight, setSelectedFight] = useState<Option | null>(null);
  const [angle, setAngle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Focus : après le choix de l'event, charger sa carte
  useEffect(() => {
    setSelectedFight(null);
    setFights([]);
    if (type === 'focus' && subject) {
      fetch(`/api/articles/event-fights?eventId=${subject.id}`)
        .then((r) => r.json())
        .then(setFights)
        .catch(() => setFights([]));
    }
  }, [type, subject]);

  const ready = type === 'focus' ? Boolean(selectedFight) : Boolean(subject);

  async function handleCreateBlank() {
    setError(null);
    try {
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          eventId: type !== 'portrait' ? subject?.id : undefined,
          fightId: type === 'focus' ? selectedFight?.id : undefined,
          fighterId: type === 'portrait' ? subject?.id : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erreur de création');
      router.push(`/articles/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleGenerate() {
    if (!ready || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/articles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          eventId: type !== 'portrait' ? subject?.id : undefined,
          fightId: type === 'focus' ? selectedFight?.id : undefined,
          fighterId: type === 'portrait' ? subject?.id : undefined,
          angle: angle.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erreur de génération');
      router.push(`/articles/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setGenerating(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-white text-2xl font-bold mb-6">Nouvel article</h1>

      {/* 1. Format */}
      <h2 className="text-gray-400 text-sm font-medium mb-2">1. Format</h2>
      <div className="grid gap-2 mb-6">
        {TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => { setType(t.value); setSubject(null); }}
            className={`text-left border rounded-xl px-4 py-3 transition-colors ${
              type === t.value
                ? 'bg-red-600/10 border-red-600/50'
                : 'bg-gray-900 border-gray-800 hover:border-gray-700'
            }`}
          >
            <div className="text-white text-sm font-medium">{t.label}</div>
            <div className="text-gray-500 text-xs mt-0.5">{t.description}</div>
          </button>
        ))}
      </div>

      {/* 2. Sujet */}
      <h2 className="text-gray-400 text-sm font-medium mb-2">
        2. Sujet · {TYPES.find((t) => t.value === type)?.subject}
      </h2>
      <div className="mb-4">
        <SubjectSearch type={type} selected={subject} onSelect={setSubject} />
      </div>

      {type === 'focus' && subject && (
        <div className="mb-6">
          <h3 className="text-gray-500 text-xs mb-2">Choisis le combat :</h3>
          {fights.length === 0 && <p className="text-gray-500 text-sm">Chargement de la carte...</p>}
          <div className="grid gap-1.5">
            {fights.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFight(f)}
                className={`text-left border rounded-lg px-3 py-2 transition-colors ${
                  selectedFight?.id === f.id
                    ? 'bg-red-600/10 border-red-600/50'
                    : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                }`}
              >
                <span className="text-white text-sm">{f.label}</span>
                {f.sublabel && <span className="text-gray-500 text-xs ml-2">{f.sublabel}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Angle */}
      <h2 className="text-gray-400 text-sm font-medium mb-2">3. Angle (facultatif)</h2>
      <input
        value={angle}
        onChange={(e) => setAngle(e.target.value)}
        placeholder="Ex. : insiste sur la revanche, angle comeback... Vide = le générateur choisit."
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500 mb-6"
      />

      {error && (
        <p className="text-red-400 text-sm mb-4 bg-red-600/10 border border-red-600/30 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={!ready || generating}
          className="bg-red-600 hover:bg-red-700 disabled:bg-gray-800 disabled:text-gray-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          {generating ? 'Génération en cours (1 à 3 minutes)...' : 'Générer le brouillon (API)'}
        </button>
        <button
          onClick={handleCreateBlank}
          disabled={generating}
          className="border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          Partir d&apos;une page blanche
        </button>
      </div>
      <p className="text-gray-500 text-xs mt-3">
        {generating
          ? 'Construction du dossier de faits depuis la DB, puis rédaction FR + EN + caption Insta. Ne quitte pas la page.'
          : 'Astuce : la rédaction gratuite passe par la commande /article dans Claude Code, qui dépose le brouillon ici. « Générer » utilise l\'API Anthropic (payante, clé requise). « Page blanche » ouvre l\'éditeur vide pour écrire toi-même.'}
      </p>
    </div>
  );
}

export default function NewArticlePage() {
  return (
    <Suspense>
      <NewArticleForm />
    </Suspense>
  );
}
