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
  is_co_main_event: boolean;
  is_title_fight: boolean;
  outcome: string | null;
  method: string | null;
  round: number | null;
  time: string | null;
  winner_id: string | null;
  red_corner_fighter_id: string | null;
  blue_corner_fighter_id: string | null;
  red: { first_name: string; last_name: string } | null;
  blue: { first_name: string; last_name: string } | null;
};

type DiffEntry = { bout: string; from: string; to: string };
type ParsedDiff = {
  renames: { from: string; to: string }[];
  newFights: string[];
  removedFights: string[];
  resultUpdates: DiffEntry[];
  hasChanges: boolean;
};

function parseDiff(logs: string[]): ParsedDiff {
  const out: ParsedDiff = { renames: [], newFights: [], removedFights: [], resultUpdates: [], hasChanges: false };

  const startIdx = logs.findIndex(l => l.includes('[DRY RUN] Diff vs DB:'));
  if (startIdx === -1) return out;

  type Section = 'none' | 'new_fights' | 'removed_fights' | 'result_updates';
  let section: Section = 'none';
  let pendingBout: string | null = null;

  for (let i = startIdx + 1; i < logs.length; i++) {
    const s = logs[i].trimStart();
    if (!s || s.startsWith('[Phase') || s.startsWith('Update complete')) {
      section = 'none';
      continue;
    }

    if (s.startsWith('~ Renamed:')) {
      const m = s.match(/~ Renamed: '(.+)' → '(.+)'/);
      if (m) { out.renames.push({ from: m[1], to: m[2] }); out.hasChanges = true; }
      section = 'none';
    } else if (s.startsWith('+ New fights:')) {
      section = 'new_fights';
      out.hasChanges = true;
    } else if (s.startsWith('- Removed fights:')) {
      section = 'removed_fights';
      out.hasChanges = true;
    } else if (s.startsWith('~ Result updates:')) {
      section = 'result_updates';
      out.hasChanges = true;
    } else if (s.startsWith('+ New events:')) {
      section = 'none';
    } else if (section === 'new_fights' && s.startsWith('+ ')) {
      out.newFights.push(s.slice(2));
    } else if (section === 'removed_fights' && s.startsWith('- ')) {
      out.removedFights.push(s.slice(2));
    } else if (section === 'result_updates') {
      const arrowIdx = s.indexOf(' → ');
      if (arrowIdx !== -1 && pendingBout) {
        out.resultUpdates.push({
          bout: pendingBout,
          from: s.slice(0, arrowIdx).trim(),
          to: s.slice(arrowIdx + 3).trim(),
        });
        pendingBout = null;
      } else if (s.includes(' vs ')) {
        pendingBout = s.trim();
      }
    }
  }

  return out;
}

type SyncStatus = 'idle' | 'running' | 'done' | 'error';

export default function EventEditForm({ event, fights }: { event: EventRow; fights: FightRow[] }) {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const [form, setForm] = useState({
    name: event.name ?? '',
    organization: event.organization ?? '',
    date: event.date ?? '',
    venue: event.venue ?? '',
    city: event.city ?? '',
    country: event.country ?? '',
    accent_color: event.accent_color ?? '',
  });

  const [syncOpen, setSyncOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [previewDone, setPreviewDone] = useState(false);
  const [applyDone, setApplyDone] = useState(false);
  const [diff, setDiff] = useState<ParsedDiff | null>(null);
  const [showRawLogs, setShowRawLogs] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);

  async function runSync(apply: boolean) {
    if (!event.sherdog_url) return;
    setSyncStatus('running');
    if (!apply) {
      setSyncLogs([]);
      setPreviewDone(false);
      setApplyDone(false);
      setDiff(null);
      setShowRawLogs(true);
    } else {
      setShowRawLogs(true);
    }

    const allLogs: string[] = [];

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
            if (apply) {
              setApplyDone(true);
            } else {
              setPreviewDone(true);
              if (code === 0) {
                setDiff(parseDiff(allLogs));
                setShowRawLogs(false);
              }
            }
          } else {
            allLogs.push(text);
            setSyncLogs([...allLogs]);
            setTimeout(() => {
              if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
            }, 0);
          }
        }
      }
    } catch (e) {
      allLogs.push(`[ERREUR] ${String(e)}`);
      setSyncLogs([...allLogs]);
      setSyncStatus('error');
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    setFormSuccess('');
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
      setFormError(d.error ?? 'Erreur');
    } else {
      setFormSuccess('Sauvegardé.');
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

  function fightResult(f: FightRow) {
    if (!f.outcome) return <span className="text-gray-600 text-xs">—</span>;

    const methodStr = f.method
      ? `${f.method}${f.round ? ` R${f.round}` : ''}${f.time ? ` ${f.time}` : ''}`
      : '';

    if (f.outcome === 'win') {
      let winnerName = '';
      if (f.winner_id === f.red_corner_fighter_id && f.red) {
        winnerName = `${f.red.first_name} ${f.red.last_name}`;
      } else if (f.winner_id === f.blue_corner_fighter_id && f.blue) {
        winnerName = `${f.blue.first_name} ${f.blue.last_name}`;
      }
      return (
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-green-400 font-semibold">W {winnerName}</span>
          {methodStr && <span className="text-xs text-gray-500">· {methodStr}</span>}
        </div>
      );
    }
    if (f.outcome === 'draw') {
      return <span className="text-xs text-yellow-400">Draw{methodStr ? ` · ${methodStr}` : ''}</span>;
    }
    if (f.outcome === 'nc') {
      return <span className="text-xs text-gray-400">NC</span>;
    }
    return <span className="text-xs text-gray-400">{f.outcome}</span>;
  }

  const syncLabelColor: Record<SyncStatus, string> = {
    idle: '',
    running: 'text-yellow-400',
    done: 'text-green-400',
    error: 'text-red-400',
  };
  const syncLabel: Record<SyncStatus, string> = {
    idle: '',
    running: '⏳ En cours...',
    done: '✓ Terminé',
    error: '✗ Erreur',
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-white text-2xl font-bold">{event.name}</h1>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-red-500 hover:text-red-400 text-sm border border-red-800 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {deleting ? 'Suppression...' : 'Supprimer'}
        </button>
      </div>

      {/* ── Edit form ──────────────────────────────────────────────────────── */}
      <form onSubmit={handleSave} className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          {field('name', 'Nom')}
          {field('organization', 'Organisation')}
          {field('date', 'Date', 'date')}
          {field('venue', 'Salle / Venue')}
          {field('city', 'Ville')}
          {field('country', 'Pays')}
          {field('accent_color', 'Couleur accent (hex)')}
        </div>
        {formError && <p className="text-red-400 text-sm mb-3">{formError}</p>}
        {formSuccess && <p className="text-green-400 text-sm mb-3">{formSuccess}</p>}
        <button
          type="submit"
          disabled={saving}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg py-2.5 px-6 text-sm transition-colors disabled:opacity-50"
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </form>

      {/* ── Sherdog Sync ───────────────────────────────────────────────────── */}
      {event.sherdog_url ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl mb-6 overflow-hidden">
          <button
            onClick={() => setSyncOpen(o => !o)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-800/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-white font-semibold text-sm">Synchroniser depuis Sherdog</span>
              {syncStatus !== 'idle' && (
                <span className={`text-xs font-medium ${syncLabelColor[syncStatus]}`}>
                  {syncLabel[syncStatus]}
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

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => runSync(false)}
                  disabled={syncStatus === 'running'}
                  className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {syncStatus === 'running' && !previewDone ? 'Analyse...' : 'Prévisualiser'}
                </button>

                {previewDone && !applyDone && diff?.hasChanges && (
                  <button
                    onClick={() => runSync(true)}
                    disabled={syncStatus === 'running'}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {syncStatus === 'running' ? 'Application...' : 'Appliquer les changements'}
                  </button>
                )}

                {applyDone && (
                  <span className="text-green-400 text-sm">✓ Changements appliqués en base.</span>
                )}
              </div>

              {/* Structured diff */}
              {diff && previewDone && (
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                  {!diff.hasChanges ? (
                    <p className="text-green-400 text-sm">✓ Aucun changement — tout est à jour.</p>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {diff.renames.length > 0 && (
                        <div>
                          <h4 className="text-yellow-400 text-xs font-semibold uppercase tracking-wide mb-2">Renommage</h4>
                          {diff.renames.map((r, i) => (
                            <p key={i} className="text-sm">
                              <span className="text-gray-500 line-through">{r.from}</span>
                              {' → '}
                              <span className="text-yellow-300">{r.to}</span>
                            </p>
                          ))}
                        </div>
                      )}

                      {diff.resultUpdates.length > 0 && (
                        <div>
                          <h4 className="text-blue-400 text-xs font-semibold uppercase tracking-wide mb-2">
                            Résultats ({diff.resultUpdates.length})
                          </h4>
                          <div className="flex flex-col gap-2">
                            {diff.resultUpdates.map((u, i) => (
                              <div key={i}>
                                <p className="text-gray-300 text-xs font-medium">{u.bout}</p>
                                <p className="text-xs ml-3">
                                  <span className="text-gray-600 line-through">{u.from}</span>
                                  {' → '}
                                  <span className="text-blue-300">{u.to}</span>
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {diff.newFights.length > 0 && (
                        <div>
                          <h4 className="text-green-400 text-xs font-semibold uppercase tracking-wide mb-2">
                            Nouveaux combats ({diff.newFights.length})
                          </h4>
                          <div className="flex flex-col gap-1">
                            {diff.newFights.map((f, i) => (
                              <p key={i} className="text-xs text-green-300">+ {f}</p>
                            ))}
                          </div>
                        </div>
                      )}

                      {diff.removedFights.length > 0 && (
                        <div>
                          <h4 className="text-red-400 text-xs font-semibold uppercase tracking-wide mb-2">
                            Combats annulés ({diff.removedFights.length})
                          </h4>
                          <div className="flex flex-col gap-1">
                            {diff.removedFights.map((f, i) => (
                              <p key={i} className="text-xs text-red-300">- {f}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Raw logs (collapsible) */}
              {syncLogs.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowRawLogs(v => !v)}
                    className="text-gray-500 hover:text-gray-400 text-xs transition-colors"
                  >
                    {showRawLogs ? '▲ Masquer les logs' : '▼ Afficher les logs bruts'}
                  </button>
                  {showRawLogs && (
                    <pre
                      ref={logRef}
                      className="mt-2 bg-gray-950 border border-gray-800 rounded-lg p-4 text-xs font-mono text-gray-400 max-h-72 overflow-y-auto whitespace-pre-wrap leading-5"
                    >
                      {syncLogs.join('\n')}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-4 mb-6">
          <span className="text-gray-500 text-sm">Aucun lien Sherdog — synchronisation indisponible.</span>
        </div>
      )}

      {/* ── Fights table ───────────────────────────────────────────────────── */}
      {fights.length > 0 && (
        <div>
          <h2 className="text-white text-lg font-semibold mb-3">Combats ({fights.length})</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Matchup</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Division</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Type</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Résultat</th>
                </tr>
              </thead>
              <tbody>
                {fights.map((f) => {
                  const redName = f.red ? `${f.red.first_name} ${f.red.last_name}` : '?';
                  const blueName = f.blue ? `${f.blue.first_name} ${f.blue.last_name}` : '?';
                  return (
                    <tr key={f.id} className="border-b border-gray-800/50 last:border-0">
                      <td className="px-4 py-3">
                        <span className="text-gray-200">{redName}</span>
                        <span className="text-gray-600 mx-2">vs</span>
                        <span className="text-gray-200">{blueName}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{f.weight_class}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {f.is_main_event
                          ? '⭐ Main Event'
                          : f.is_co_main_event
                          ? '✨ Co-Main'
                          : f.is_title_fight
                          ? '🏆 Title'
                          : '—'}
                      </td>
                      <td className="px-4 py-3">{fightResult(f)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
