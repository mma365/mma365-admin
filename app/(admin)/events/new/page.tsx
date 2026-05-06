'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function NewEventPage() {
  const router = useRouter();
  const supabase = createClient();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sherdogUrl, setSherdogUrl] = useState('');
  const [importing, setImporting] = useState(false);

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
    setError('');
    try {
      const res = await fetch('/api/import/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sherdogUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Erreur import');
      } else if (data.id) {
        router.push(`/events/${data.id}`);
        return;
      }
    } catch {
      setError('Erreur réseau');
    }
    setImporting(false);
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
            className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
          />
          <button
            onClick={handleImport}
            disabled={importing || !sherdogUrl.trim()}
            className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {importing ? 'Import...' : 'Importer'}
          </button>
        </div>
        <p className="text-gray-600 text-xs mt-2">Nécessite l&apos;API /api/import/event (non disponible en prod, utiliser le scraper)</p>
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
