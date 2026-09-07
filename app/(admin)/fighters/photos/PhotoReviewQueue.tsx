'use client';

import { useState } from 'react';
import PhotoCropper, { type PixelCrop } from './PhotoCropper';

export type CandidateFighter = {
  id: string;
  first_name: string;
  last_name: string;
  organization: string;
};

// fetch() has no upload-progress event — only XMLHttpRequest does. Used for
// the file-upload "Remplacer" path, where the payload is an actual photo
// (can be a few MB) rather than a few bytes of JSON.
function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (percent: number) => void
): Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: unknown = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* non-JSON response */ }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, json: async () => data });
    };
    xhr.onerror = () => reject(new Error("Erreur réseau pendant l'envoi"));
    xhr.send(formData);
  });
}

type ModalState =
  | { mode: 'replace-input'; fighter: CandidateFighter }
  | { mode: 'replace-crop'; fighter: CandidateFighter; imageUrl: string; file?: File }
  | null;

// Every fighter shown here has no automatically-found photo (photo_not_found)
// — the pipeline already publishes a find straight to image_uri with no
// review step, so this queue only ever needs "Remplacer" (source manually)
// or "Rejeter" (give up, stop automatic retries).
export default function PhotoReviewQueue({ candidates: initial }: { candidates: CandidateFighter[] }) {
  const [candidates, setCandidates] = useState(initial);
  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [replaceUrl, setReplaceUrl] = useState('');

  function removeFromQueue(fighterId: string) {
    setCandidates((prev) => prev.filter((f) => f.id !== fighterId));
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

  async function confirmApprove(fighter: CandidateFighter, crop: PixelCrop, file?: File) {
    setBusy(true);
    setError('');
    try {
      let res: { ok: boolean; json: () => Promise<unknown> };

      if (file) {
        const form = new FormData();
        form.append('source', 'manual');
        form.append('crop', JSON.stringify(crop));
        form.append('file', file);
        setUploadProgress(0);
        res = await uploadWithProgress(`/api/fighters/photos/${fighter.id}/approve`, form, setUploadProgress);
      } else {
        res = await fetch(`/api/fighters/photos/${fighter.id}/approve`, {
          method: 'POST',
          body: JSON.stringify({ source: 'manual', crop, imageUrl: replaceUrl.trim() }),
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? 'Erreur lors de la validation');
      }
      removeFromQueue(fighter.id);
      setModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setUploadProgress(null);
    }
  }

  async function reject(fighter: CandidateFighter) {
    if (!confirm(`Rejeter ${fighter.first_name} ${fighter.last_name} ? Il ne sera plus reproposé automatiquement.`)) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/fighters/photos/${fighter.id}/reject`, { method: 'POST' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Erreur lors du rejet');
      }
      removeFromQueue(fighter.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && (
        <div className="mb-4 bg-red-950/40 border border-red-900 text-red-400 text-sm rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {candidates.map((f) => {
          const initials = `${f.first_name[0] ?? ''}${f.last_name[0] ?? ''}`.toUpperCase();
          return (
            <div key={f.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
              <div className="p-3">
                <div className="w-full aspect-square rounded-2xl bg-gray-800 border border-dashed border-gray-700 flex flex-col items-center justify-center gap-1.5">
                  <span className="text-gray-600 text-2xl font-bold">{initials}</span>
                  <span className="text-gray-600 text-[10px] uppercase tracking-wide">Pas de photo trouvée</span>
                </div>
              </div>
              <div className="px-3 pb-3 flex flex-col gap-2 flex-1">
                <div>
                  <p className="text-white text-sm font-medium truncate">{f.first_name} {f.last_name}</p>
                  <p className="text-gray-500 text-xs">{f.organization}</p>
                </div>
                <div className="mt-auto flex gap-1.5">
                  <button
                    onClick={() => openReplace(f)}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
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
          );
        })}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-white font-semibold mb-4">
              {modal.fighter.first_name} {modal.fighter.last_name}
            </h2>

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
              <>
                {uploadProgress !== null && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span>Envoi en cours...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-600 transition-all duration-150"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
                <PhotoCropper
                  imageUrl={modal.imageUrl}
                  busy={busy}
                  confirmLabel="Valider la photo"
                  onCancel={() => setModal(null)}
                  onConfirm={(crop) => confirmApprove(modal.fighter, crop, modal.file)}
                />
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
