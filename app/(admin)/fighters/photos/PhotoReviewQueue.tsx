'use client';

import { useState } from 'react';
import PhotoCropper, { type PixelCrop } from './PhotoCropper';

export type CandidateFighter = {
  id: string;
  first_name: string;
  last_name: string;
  organization: string;
  image_uri_candidate: string | null;
  photo_not_found: boolean;
};

type SuggestedCropMeta = PixelCrop;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const BUCKET_PUBLIC_BASE = `${SUPABASE_URL}/storage/v1/object/public/fighter-photos`;

function pendingSourceUrl(fighterId: string) {
  return `${BUCKET_PUBLIC_BASE}/pending/${fighterId}_source.jpg`;
}
function pendingCropMetaUrl(fighterId: string) {
  return `${BUCKET_PUBLIC_BASE}/pending/${fighterId}.json`;
}

type ModalState =
  | { mode: 'adjust'; fighter: CandidateFighter }
  | { mode: 'replace-input'; fighter: CandidateFighter }
  | { mode: 'replace-crop'; fighter: CandidateFighter; imageUrl: string; file?: File }
  | null;

export default function PhotoReviewQueue({ candidates: initial }: { candidates: CandidateFighter[] }) {
  const [candidates, setCandidates] = useState(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState('');
  const [initialBoxes, setInitialBoxes] = useState<Record<string, SuggestedCropMeta | null>>({});
  const [replaceUrl, setReplaceUrl] = useState('');

  function removeFromQueue(fighterIds: string[]) {
    const idSet = new Set(fighterIds);
    setCandidates((prev) => prev.filter((f) => !idSet.has(f.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      fighterIds.forEach((id) => next.delete(id));
      return next;
    });
  }

  function toggleSelected(fighterId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fighterId)) next.delete(fighterId);
      else next.add(fighterId);
      return next;
    });
  }

  function selectAll() {
    // Only fighters with an actual suggested photo can be bulk-approved —
    // "not found" cards have nothing to promote.
    setSelected(new Set(candidates.filter((f) => f.image_uri_candidate).map((f) => f.id)));
  }
  function clearSelection() {
    setSelected(new Set());
  }

  async function loadInitialBox(fighterId: string) {
    if (fighterId in initialBoxes) return;
    try {
      const res = await fetch(pendingCropMetaUrl(fighterId));
      if (res.ok) {
        const box = await res.json();
        setInitialBoxes((prev) => ({ ...prev, [fighterId]: box }));
      } else {
        setInitialBoxes((prev) => ({ ...prev, [fighterId]: null }));
      }
    } catch {
      setInitialBoxes((prev) => ({ ...prev, [fighterId]: null }));
    }
  }

  async function openAdjust(fighter: CandidateFighter) {
    setError('');
    await loadInitialBox(fighter.id);
    setModal({ mode: 'adjust', fighter });
  }

  function openReplace(fighter: CandidateFighter) {
    setError('');
    setReplaceUrl('');
    setModal({ mode: 'replace-input', fighter });
  }

  function handleFileChosen(fighter: CandidateFighter, file: File) {
    const url = URL.createObjectURL(file);
    setModal({ mode: 'replace-crop', fighter, imageUrl: url, file });
  }

  function handleUrlChosen(fighter: CandidateFighter) {
    if (!replaceUrl.trim()) return;
    setModal({ mode: 'replace-crop', fighter, imageUrl: replaceUrl.trim() });
  }

  // Accepts the already-computed suggested crop as-is — one click, no modal.
  // Used both by each card's own "Valider" button and by the bulk action bar.
  async function approveSuggested(fighterIds: string[]) {
    setBulkBusy(true);
    setError('');
    try {
      const res = await fetch('/api/fighters/photos/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fighterIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Erreur lors de la validation');

      const results = (data.results ?? []) as { id: string; ok: boolean; error?: string }[];
      const okIds = results.filter((r) => r.ok).map((r) => r.id);
      const failed = results.filter((r) => !r.ok);
      removeFromQueue(okIds);
      if (failed.length) {
        setError(`${failed.length} photo(s) non validée(s) : ${failed.map((f) => f.error).join(', ')}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBulkBusy(false);
    }
  }

  async function confirmApprove(fighter: CandidateFighter, crop: PixelCrop, source: 'candidate' | 'manual', file?: File) {
    setBusy(true);
    setError('');
    try {
      let body: BodyInit;
      let headers: Record<string, string> | undefined;

      if (source === 'manual' && file) {
        const form = new FormData();
        form.append('source', 'manual');
        form.append('crop', JSON.stringify(crop));
        form.append('file', file);
        body = form;
      } else if (source === 'manual') {
        body = JSON.stringify({ source: 'manual', crop, imageUrl: replaceUrl.trim() });
        headers = { 'Content-Type': 'application/json' };
      } else {
        body = JSON.stringify({ source: 'candidate', crop });
        headers = { 'Content-Type': 'application/json' };
      }

      const res = await fetch(`/api/fighters/photos/${fighter.id}/approve`, { method: 'POST', body, headers });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Erreur lors de la validation');
      }
      removeFromQueue([fighter.id]);
      setModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function reject(fighter: CandidateFighter) {
    if (!confirm(`Rejeter la photo de ${fighter.first_name} ${fighter.last_name} ? Elle ne sera plus reproposée automatiquement.`)) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/fighters/photos/${fighter.id}/reject`, { method: 'POST' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Erreur lors du rejet');
      }
      removeFromQueue([fighter.id]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const anySelected = selected.size > 0;

  return (
    <>
      {error && (
        <div className="mb-4 bg-red-950/40 border border-red-900 text-red-400 text-sm rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5">
        <div className="flex items-center gap-3">
          <button
            onClick={anySelected ? clearSelection : selectAll}
            className="text-gray-400 hover:text-white text-xs font-medium transition-colors"
          >
            {anySelected ? 'Désélectionner tout' : 'Tout sélectionner'}
          </button>
          {anySelected && <span className="text-gray-600 text-xs">{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</span>}
        </div>
        {anySelected && (
          <button
            onClick={() => approveSuggested(Array.from(selected))}
            disabled={bulkBusy}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
          >
            {bulkBusy ? 'Validation...' : `Valider la sélection (${selected.size})`}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {candidates.map((f) => {
          const hasPhoto = Boolean(f.image_uri_candidate);
          const initials = `${f.first_name[0] ?? ''}${f.last_name[0] ?? ''}`.toUpperCase();

          return (
            <div key={f.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
              <div className="p-3 relative">
                {hasPhoto && (
                  <label className="absolute top-5 left-5 z-10 flex items-center justify-center w-5 h-5 rounded bg-gray-950/80 border border-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(f.id)}
                      onChange={() => toggleSelected(f.id)}
                      className="w-3.5 h-3.5 accent-red-600 cursor-pointer"
                    />
                  </label>
                )}
                {hasPhoto ? (
                  // Preview shaped like the app's Avatar (rounded square, not a circle)
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.image_uri_candidate!}
                    alt={`${f.first_name} ${f.last_name}`}
                    className="w-full aspect-square object-cover rounded-2xl bg-gray-800"
                  />
                ) : (
                  <div className="w-full aspect-square rounded-2xl bg-gray-800 border border-dashed border-gray-700 flex flex-col items-center justify-center gap-1.5">
                    <span className="text-gray-600 text-2xl font-bold">{initials}</span>
                    <span className="text-gray-600 text-[10px] uppercase tracking-wide">Pas de photo trouvée</span>
                  </div>
                )}
              </div>
              <div className="px-3 pb-3 flex flex-col gap-2 flex-1">
                <div>
                  <p className="text-white text-sm font-medium truncate">{f.first_name} {f.last_name}</p>
                  <p className="text-gray-500 text-xs">{f.organization}</p>
                </div>
                <div className="mt-auto flex flex-col gap-1.5">
                  {hasPhoto && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => approveSuggested([f.id])}
                        disabled={bulkBusy}
                        className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Valider
                      </button>
                      <button
                        onClick={() => openAdjust(f)}
                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Ajuster
                      </button>
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => openReplace(f)}
                      className={`flex-1 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                        hasPhoto
                          ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                          : 'bg-red-600 hover:bg-red-700 text-white font-semibold'
                      }`}
                    >
                      Remplacer
                    </button>
                    <button
                      onClick={() => reject(f)}
                      className="flex-1 bg-gray-800 hover:bg-red-950 text-gray-400 hover:text-red-400 text-xs px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Rejeter
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-white font-semibold mb-4">
              {modal.fighter.first_name} {modal.fighter.last_name}
            </h2>

            {modal.mode === 'adjust' && (
              <PhotoCropper
                imageUrl={pendingSourceUrl(modal.fighter.id)}
                initialCropPixels={initialBoxes[modal.fighter.id] ?? null}
                busy={busy}
                onCancel={() => setModal(null)}
                onConfirm={(crop) => confirmApprove(modal.fighter, crop, 'candidate')}
              />
            )}

            {modal.mode === 'replace-input' && (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Coller une URL d&apos;image</label>
                  <input
                    type="url"
                    value={replaceUrl}
                    onChange={(e) => setReplaceUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
                  />
                </div>
                <div className="flex items-center gap-2 text-gray-600 text-xs">— ou —</div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Uploader un fichier</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileChosen(modal.fighter, file);
                    }}
                    className="text-gray-300 text-sm"
                  />
                </div>
                <div className="flex items-center gap-3 justify-end">
                  <button onClick={() => setModal(null)} className="text-gray-400 hover:text-white text-sm px-4 py-2">
                    Annuler
                  </button>
                  <button
                    disabled={!replaceUrl.trim()}
                    onClick={() => handleUrlChosen(modal.fighter)}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                  >
                    Continuer
                  </button>
                </div>
              </div>
            )}

            {modal.mode === 'replace-crop' && (
              <PhotoCropper
                imageUrl={modal.imageUrl}
                busy={busy}
                confirmLabel="Valider la photo"
                onCancel={() => setModal(null)}
                onConfirm={(crop) => confirmApprove(modal.fighter, crop, 'manual', modal.file)}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
