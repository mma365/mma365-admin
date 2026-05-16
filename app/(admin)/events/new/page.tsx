'use client';

export const dynamic = 'force-dynamic';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function NewEventPage() {
  const router = useRouter();
  const supabase = createClient();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sherdogUrl, setSherdogUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [importDone, setImportDone] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);

  const [form, setForm] = useState({
    name: '',
    organization: '',
    date: '',
    venue: '',
    city: '',
    country: '',
    accent_color: '',
  });

  function field(key: keyof typeof form, label: string, type = 'text') {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-gray-400 text-xs">{label}</label>
        <input
          type={type}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
        />
      </div>
    );
  }

  async function handleImport() {
    if (!sherdogUrl.trim()) return;
    setImporting(true);
    setImportDone(false);
    setImportLogs([]);
    setError('');

    const allLogs: string[] = [];

    try {
      const res = await fetch('/api/scrape/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sherdog_url: sherdogUrl.trim(), apply: true, set_manual: true }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const raw = decoder.decode(value, { stream: true });
        for (const line of raw.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;

          let text: string;
          try { text = JSON.parse(payload); } catch { text = payload; }

          if (text.startsWith('[DONE:')) {
            const code = parseInt(text.match(/\d+/)?.[0] ?? '0', 10);
            setImportDone(true);
            setImporting(false);
            if (code === 0) {
              setTimeout(() => router.push('/events'), 1500);
            } else {
              setError(`Scraper terminé avec le code ${code}`);
            }
          } else {
            allLogs.push(text);
            setImportLogs([...allLogs]);
            setTimeout(() => {
              if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
            }, 0);
          }
        }
      }
    } catch (e) {
      setError(`Erreur réseau : ${String(e)}`);
      setImporting(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.organization || !form.date) {
      setError('Nom, organisation et date sont requis.');
      return;
    }
    setSaving(true);
    setError('');
    const { data, error: err } = await supabase
      .from('events')
      .insert({
        name: form.name,
        organization: form.organization,
        date: form.date,
        venue: form.venue || null,
        city: form.city || null,
        country: form.country || null,
        accent_color: form.accent_color || null,
        is_manual: true,
      })
      .select('id')
      .single();
    setSaving(false);
    if (err) {
      setError(err.message);
    } else if (data) {
      router.push(`/events/${data.id}`);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-white text-2xl font-bold mb-6">Nouvel event</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <p className="text-gray-400 text-sm mb-3">Importer depuis Sherdog</p>
        <div className="flex gap-3">
          <input
            type="url"
            placeholder="https://www.sherdog.com/events/..."
            value={sherdogUrl}
            onChange={(e) => setSherdogUrl(e.target.value)}
            disabled={importing}
            className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 disabled:opacity-50"
          />
          <button
            onClick={handleImport}
            disabled={importing || !sherdogUrl.trim()}
            className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {importing ? 'Import en cours...' : 'Importer'}
          </button>
        </div>
        <p className="text-gray-500 text-xs mt-2">Lance le scraper local. L&apos;event apparaîtra dans la section &quot;Autres&quot; de l&apos;app.</p>

        {/* Live logs */}
        {importLogs.length > 0 && (
          <div className="mt-4">
            <pre
              ref={logRef}
              className="bg-gray-950 border border-gray-800 rounded-lg p-4 text-xs font-mono text-gray-400 max-h-64 overflow-y-auto whitespace-pre-wrap leading-5"
            >
              {importLogs.join('\n')}
            </pre>
            {importDone && !error && (
              <p className="text-green-400 text-sm mt-2">✓ Import terminé — redirection...</p>
            )}
          </div>
        )}

        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </div>

      <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col gap-4">
        <p className="text-gray-400 text-sm -mb-1">Ou créer manuellement</p>
        {field('name', 'Nom *')}
        {field('organization', 'Organisation *')}
        {field('date', 'Date *', 'date')}
        {field('venue', 'Salle / Venue')}
        {field('city', 'Ville')}
        {field('country', 'Pays')}
        {field('accent_color', 'Couleur accent (hex)')}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50 mt-2"
        >
          {saving ? 'Création...' : 'Créer'}
        </button>
      </form>
    </div>
  );
}
