'use client';

import { useCallback, useState } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';

export type PixelCrop = { x: number; y: number; width: number; height: number };

// Avatar.tsx never uses circle={true} anywhere in the app today — every
// fighter avatar renders as a rounded square, not a full circle. The crop
// tool below uses a plain square guide (react-easy-crop has no built-in
// "rounded square" cropShape) with a rounded-square live preview alongside it
// so what Rachid sees next to the cropper matches what the app will show.

type Props = {
  imageUrl: string;
  /** Suggested crop, in pixel coords of `imageUrl` — same box used to render the
   *  candidate thumbnail already shown in the queue. Opens the cropper
   *  pre-positioned on it instead of a plain center crop. Omit for a
   *  manually-supplied replacement photo, which has no suggestion yet. */
  initialCropPixels?: PixelCrop | null;
  onCancel: () => void;
  onConfirm: (crop: PixelCrop) => void;
  confirmLabel?: string;
  busy?: boolean;
};

export default function PhotoCropper({
  imageUrl, initialCropPixels, onCancel, onConfirm, confirmLabel = 'Valider', busy = false,
}: Props) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(initialCropPixels ?? null);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full h-80 bg-black rounded-lg overflow-hidden">
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="rect"
          showGrid={true}
          initialCroppedAreaPixels={initialCropPixels ?? undefined}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="text-gray-400 text-xs shrink-0">Zoom</label>
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1"
        />
      </div>

      {initialCropPixels && (
        <p className="text-gray-600 text-xs">
          Cadrage suggéré à partir du visage détecté — ajuste si besoin.
        </p>
      )}

      <div className="flex items-center gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="text-gray-400 hover:text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          type="button"
          disabled={!croppedAreaPixels || busy}
          onClick={() => croppedAreaPixels && onConfirm({
            x: Math.round(croppedAreaPixels.x),
            y: Math.round(croppedAreaPixels.y),
            width: Math.round(croppedAreaPixels.width),
            height: Math.round(croppedAreaPixels.height),
          })}
          className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {busy ? 'Enregistrement...' : confirmLabel}
        </button>
      </div>
    </div>
  );
}
