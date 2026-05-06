'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type EventRow = Record<string, unknown> & {
  id: string;
  name: string;
  organization: string;
  date: string;
  venue: string | null;
  city: string | null;
  country: string | null;
  accent_color: string | null;
  sherdog_url: string | null;
};

type FightRow = {
  id: string;
  weight_class: string;
  is_main_event: boolean;
  is_title_fight: boolean;
  outcome: string | null;
};

type SyncStatus = 'idle' | 'running' | 'done' | 'error';

export default function EventEditForm({ event, fights }: { event: EventRow; fights: FightRow[] }) {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    name: event.name ?? '',
    organization: event.organization ?? '',
    date: event.date ?? '',
    venue: event.venue ?? '',
    city: event.city ?? '',
    country: event.country ?? '',
    accent_color: event.accent_color ?? '',
  });

  // ── Sherdog sync ──────────────────────────────────────────────────────────
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [previewDone, setPreviewDone] = useState(false);
  const [applyDone, setApplyDone] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);

  async function runSync(apply: boolean) {
    if (!event.sherdog_url) return;
    setSyncStatus('running');
    if (!apply) {
      setSyncLogs([]);
      setPreviewDone(false);
      setApplyDone(false);
    }

    try {
      const res = await fetch('/api/scrape/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sherdog_url: event.sherdog_url, apply }),
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
            setSyncStatus(code === 0 ? 'done' : 'error');
            if (apply) setApplyDone(true);
            else setPreviewDone(true);
          } else {
            setSyncLogs((prev) => {
              const next = [...prev, text];
              setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 0);
              return next;
            });
          }
        }
      }
    } catch (e) {
      setSyncLogs((prev) => [...prev, `[ERREUR] ${String(e)}`]);
      setSyncStatus('error');
    }
  }

  // ── Form helpers ──────────────────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    const res = await fetch(`/api/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        organization: form.organization,
        date: form.date,
        venue: form.venue || null,
        city: form.city || null,
        country: form.country || null,
        accent_color: form.accent_color || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? 'Erreur');
    } else {
      setSuccess('Sauvegardé.');
    }
  }

  async function handleDelete() {
    if (!confirm('Supprimer cet event ? Cette action est irréversible.')) return;
    setDeleting(true);
    await fetch(`/api/events/${event.id}`, { method: 'DELETE' });
    router.push('/events');
  }

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

  const statusColor: Record<SyncStatus, string> = {
    idle: 'text-gray-400',
    running: 'text-yellow-400',
    done: 'text-green-400',
    error: 'text-red-400',
  };
  const statusLabel: Record<SyncStatus, string> = {
    idle: '',
    running: '⏳ En cours...',
    done: '✓ Terminé',
    error: '✗ Erreur',
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-white text-2xl font-bold">Éditer l&apos;event</h1>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-red-500 hover:text-red-400 text-sm border border-red-800 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {deleting ? 'Suppression...' : 'Supprimer'}
        </button>
      </div>

      <form onSubmit={handleSave} className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col gap-4 mb-6">
        {field('name', 'Nom')}
        {field('organization', 'Organisation')}
        {field('date', 'Date', 'date')}
        {field('venue', 'Salle / Venue')}
        {field('city', 'Ville')}
        {field('country', 'Pays')}
        {field('accent_color', 'Couleur accent (hex)')}

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {success && <p className="text-green-400 text-sm">{success}</p>}

        <button
          type="submit"
          disabled={saving}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50 mt-2"
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </form>

      {/* ── Sherdog Sync ──────────────────────────────────────────────────── */}
      {event.sherdog_url ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl mb-8 overflow-hidden">
          <button
            onClick={() => setSyncOpen((o) => !o)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-800/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-white font-semibold text-sm">Synchroniser depuis Sherdog</span>
              {syncStatus !== 'idle' && (
                <span className={`text-xs font-medium ${statusColor[syncStatus]}`}>
                  {statusLabel[syncStatus]}
                </span>
              )}
            </div>
            <span className="text-gray-500 text-xs">{syncOpen ? '▲' : '▼'}</span>
          </button>

          {syncOpen && (
            <div className="border-t border-gray-800 p-6 flex flex-col gap-4">
              <p className="text-gray-400 text-xs">
                URL :{' '}
                <a href={event.sherdog_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                  {event.sherdog_url}
                </a>
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => runSync(false)}
                  disabled={syncStatus === 'running'}
                  className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {syncStatus === 'running' && !previewDone ? 'Analyse...' : 'Prévisualiser'}
                </button>

                {previewDone && !applyDone && (
                  <button
                    onClick={() => runSync(true)}
                    disabled={syncStatus === 'running'}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {syncStatus === 'running' ? 'Application...' : 'Appliquer les changements'}
                  </button>
                )}

                {applyDone && (
                  <span className="text-green-400 text-sm self-center">Changements appliqués en base.</span>
                )}
              </div>

              {syncLogs.length > 0 && (
                <pre
                  ref={logRef}
                  className="bg-gray-950 border border-gray-800 rounded-lg p-4 text-xs font-mono text-gray-300 max-h-80 overflow-y-auto whitespace-pre-wrap leading-5"
                >
                  {syncLogs.join('\n')}
                </pre>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-4 mb-8 flex items-center gap-2">
          <span className="text-gray-500 text-sm">Aucun lien Sherdog — synchronisation indisponible.</span>
        </div>
      )}

      {/* ── Fights list ───────────────────────────────────────────────────── */}
      {fights.length > 0 && (
        <div>
          <h2 className="text-white text-lg font-semibold mb-3">Combats ({fights.length})</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Division</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Type</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Résultat</th>
                </tr>
              </thead>
              <tbody>
                {fights.map((f) => (
                  <tr key={f.id} className="border-b border-gray-800/50">
                    <td className="px-4 py-2.5 text-gray-300">{f.weight_class}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">
                      {f.is_main_event ? '⭐ Main Event' : f.is_title_fight ? '🏆 Title' : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {f.outcome ? (
                        <span className="text-xs bg-green-900/40 text-green-400 px-2 py-0.5 rounded">{f.outcome}</span>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
