'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type FighterRow = Record<string, unknown> & {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  organization: string;
  weight_class: string;
  country: string;
  wins: number;
  losses: number;
  draws: number;
  no_contests: number;
  date_of_birth: string | null;
  height: string | null;
  reach: string | null;
  stance: string | null;
  image_uri: string | null;
  sherdog_url: string | null;
};

type FighterDiffField = { field: string; from: string; to: string };
type FighterDiff = { fields: FighterDiffField[]; hasChanges: boolean };

const FIELD_LABELS: Record<string, string> = {
  first_name:    'Prénom',
  last_name:     'Nom',
  nickname:      'Surnom',
  weight_class:  'Division',
  country:       'Pays',
  wins:          'Victoires',
  losses:        'Défaites',
  draws:         'Nuls',
  no_contests:   'NC',
  date_of_birth: 'Date de naissance',
  height:        'Taille',
  stance:        'Stance',
};

function parseFighterDiff(logs: string[]): FighterDiff {
  const out: FighterDiff = { fields: [], hasChanges: false };

  const startIdx = logs.findIndex(l => l.includes('[DRY RUN] Diff vs DB:'));
  if (startIdx === -1) return out;

  for (let i = startIdx + 1; i < logs.length; i++) {
    const s = logs[i].trimStart();
    if (!s) continue;
    const m = s.match(/^~ (\w+): '(.*)' → '(.*)'$/);
    if (m) {
      out.fields.push({ field: m[1], from: m[2], to: m[3] });
      out.hasChanges = true;
    }
  }

  return out;
}

type SyncStatus = 'idle' | 'running' | 'done' | 'error';

export default function FighterEditForm({ fighter }: { fighter: FighterRow }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const [form, setForm] = useState({
    first_name:    fighter.first_name ?? '',
    last_name:     fighter.last_name ?? '',
    nickname:      fighter.nickname ?? '',
    organization:  fighter.organization ?? '',
    weight_class:  fighter.weight_class ?? '',
    country:       fighter.country ?? '',
    wins:          String(fighter.wins ?? 0),
    losses:        String(fighter.losses ?? 0),
    draws:         String(fighter.draws ?? 0),
    no_contests:   String(fighter.no_contests ?? 0),
    date_of_birth: fighter.date_of_birth ?? '',
    height:        fighter.height ?? '',
    reach:         fighter.reach ?? '',
    stance:        fighter.stance ?? '',
    image_uri:     fighter.image_uri ?? '',
  });

  const [syncOpen, setSyncOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [previewDone, setPreviewDone] = useState(false);
  const [applyDone, setApplyDone] = useState(false);
  const [diff, setDiff] = useState<FighterDiff | null>(null);
  const [showRawLogs, setShowRawLogs] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);

  async function runSync(apply: boolean) {
    if (!fighter.sherdog_url) return;
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
      const res = await fetch('/api/scrape/fighter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sherdog_url: fighter.sherdog_url, apply }),
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
                setDiff(parseFighterDiff(allLogs));
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
    const res = await fetch(`/api/fighters/${fighter.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name:    form.first_name,
        last_name:     form.last_name,
        nickname:      form.nickname || null,
        organization:  form.organization,
        weight_class:  form.weight_class,
        country:       form.country,
        wins:          Number(form.wins),
        losses:        Number(form.losses),
        draws:         Number(form.draws),
        no_contests:   Number(form.no_contests),
        date_of_birth: form.date_of_birth || null,
        height:        form.height || null,
        reach:         form.reach || null,
        stance:        form.stance || null,
        image_uri:     form.image_uri || null,
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
    if (!confirm('Supprimer ce fighter ? Cette action est irréversible.')) return;
    setDeleting(true);
    await fetch(`/api/fighters/${fighter.id}`, { method: 'DELETE' });
    router.push('/fighters');
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

  const syncLabelColor: Record<SyncStatus, string> = {
    idle: '', running: 'text-yellow-400', done: 'text-green-400', error: 'text-red-400',
  };
  const syncLabel: Record<SyncStatus, string> = {
    idle: '', running: '⏳ En cours...', done: '✓ Terminé', error: '✗ Erreur',
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-white text-2xl font-bold">
          {fighter.first_name} {fighter.last_name}
        </h1>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-red-500 hover:text-red-400 text-sm border border-red-800 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {deleting ? 'Suppression...' : 'Supprimer'}
        </button>
      </div>

      {/* ── Edit form ──────────────────────────────────────────────────────── */}
      <form onSubmit={handleSave} className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col gap-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          {field('first_name', 'Prénom')}
          {field('last_name', 'Nom')}
        </div>
        {field('nickname', 'Surnom')}
        <div className="grid grid-cols-2 gap-4">
          {field('organization', 'Organisation')}
          {field('weight_class', 'Division')}
        </div>
        {field('country', 'Pays')}
        <div className="grid grid-cols-4 gap-3">
          {field('wins', 'Victoires', 'number')}
          {field('losses', 'Défaites', 'number')}
          {field('draws', 'Nuls', 'number')}
          {field('no_contests', 'NC', 'number')}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {field('date_of_birth', 'Date de naissance', 'date')}
          {field('stance', 'Stance')}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {field('height', 'Taille')}
          {field('reach', 'Allonge')}
        </div>
        {field('image_uri', 'Image URL')}

        {formError && <p className="text-red-400 text-sm">{formError}</p>}
        {formSuccess && <p className="text-green-400 text-sm">{formSuccess}</p>}

        <button
          type="submit"
          disabled={saving}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50 mt-2"
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </form>

      {/* ── Sherdog Sync ───────────────────────────────────────────────────── */}
      {fighter.sherdog_url ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
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
                <a href={fighter.sherdog_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                  {fighter.sherdog_url}
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
                    <div>
                      <h4 className="text-blue-400 text-xs font-semibold uppercase tracking-wide mb-3">
                        Changements ({diff.fields.length})
                      </h4>
                      <div className="flex flex-col gap-2">
                        {diff.fields.map((f, i) => (
                          <div key={i} className="flex items-baseline gap-2 text-xs">
                            <span className="text-gray-500 w-32 shrink-0">
                              {FIELD_LABELS[f.field] ?? f.field}
                            </span>
                            <span className="text-gray-600 line-through">{f.from || '—'}</span>
                            <span className="text-gray-500">→</span>
                            <span className="text-blue-300">{f.to || '—'}</span>
                          </div>
                        ))}
                      </div>
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
                      className="mt-2 bg-gray-950 border border-gray-800 rounded-lg p-4 text-xs font-mono text-gray-400 max-h-64 overflow-y-auto whitespace-pre-wrap leading-5"
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
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-4">
          <span className="text-gray-500 text-sm">Aucun lien Sherdog — synchronisation indisponible.</span>
        </div>
      )}
    </div>
  );
}
