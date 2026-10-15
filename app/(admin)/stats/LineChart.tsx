'use client';

/**
 * Courbe d'une seule série (page Stats) : ligne 2 px, léger voile dessous, grille en traits
 * fins. Survol (ou flèches ← → au clavier) : une ligne verticale suit le point le plus proche
 * et affiche sa valeur. Le pic est étiqueté ; le détail de chaque point reste lisible sans
 * survol dans le tableau repliable en dessous.
 */
import { useEffect, useRef, useState } from 'react';

const LINE = '#3987e5';      // bleu validé ≥ 3:1 sur gray-900
const SURFACE = '#111827';   // gray-900, fond des cartes
const GRID = '#1f2937';      // gray-800
const AXIS = '#374151';      // gray-700
const MUTED = '#9ca3af';     // gray-400
const MARKER = '#6b7280';    // gray-500

export type ChartPoint = {
  /** Libellé court sous l'axe (ex. « 09 h », « 15/10 »). */
  axis: string;
  /** Libellé complet dans l'infobulle et le tableau (ex. « sam. 15/11 · 09 h – 10 h »). */
  tip: string;
  n: number;
};
export type ChartMarker = { index: number; label: string };

const PAD = { left: 40, right: 16, top: 28, bottom: 26 };

function fmt(n: number): string {
  return n.toLocaleString('fr-FR');
}

/** Graduation haute « propre » juste au-dessus du maximum (25 → 30, 40 → 40, 7 → 8). */
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 1.5, 2, 3, 4, 5, 6, 8, 10]) if (m * pow >= max) return m * pow;
  return 10 * pow;
}

export default function LineChart({
  points,
  unit,
  markers = [],
  height = 200,
}: {
  points: ChartPoint[];
  unit: string;
  markers?: ChartMarker[];
  height?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = Math.max(0, ...points.map((p) => p.n));
  if (points.length === 0 || max === 0) {
    return <p className="text-gray-500 text-sm py-6">Aucune donnée sur la période.</p>;
  }

  const yMax = niceMax(max);
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const step = points.length > 1 ? plotW / (points.length - 1) : 0;
  const x = (i: number) => PAD.left + (points.length > 1 ? i * step : plotW / 2);
  const y = (n: number) => PAD.top + plotH - (n / yMax) * plotH;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.n).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;

  const peak = points.reduce((best, p, i) => (p.n > points[best].n ? i : best), 0);
  const last = points.length - 1;
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  // Libellés de l'axe X espacés ; le dernier point est toujours libellé, donc on saute
  // un libellé régulier trop proche de lui pour éviter le chevauchement.
  const showAxis = (i: number) => i === last || (i % labelEvery === 0 && last - i >= labelEvery / 2);
  // Graduations Y entières seulement (pas de « 1,5 » arrondi en « 2 »).
  const yTicks = Number.isInteger(yMax / 2) ? [0, yMax / 2, yMax] : [0, yMax];
  // Repères proches : le premier libellé part vers la gauche, le second vers la droite.
  const sortedMarkers = [...markers].sort((m1, m2) => m1.index - m2.index);
  const markerAnchor = (k: number): 'start' | 'middle' | 'end' => {
    const close = (a: number, b: number) => Math.abs(x(sortedMarkers[a].index) - x(sortedMarkers[b].index)) < 110;
    if (k > 0 && close(k, k - 1)) return 'start';
    if (k < sortedMarkers.length - 1 && close(k, k + 1)) return 'end';
    return 'middle';
  };
  const total = points.reduce((s, p) => s + p.n, 0);

  function indexAt(clientX: number): number {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect || points.length < 2) return 0;
    const i = Math.round((clientX - rect.left - PAD.left) / step);
    return Math.min(points.length - 1, Math.max(0, i));
  }

  const a = active !== null ? points[active] : null;
  const tipLeft = active !== null ? Math.min(Math.max(x(active), 80), width - 80) : 0;

  return (
    <div>
      <div ref={boxRef} className="relative">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Courbe : ${fmt(total)} ${unit} au total, pic de ${fmt(points[peak].n)} (${points[peak].tip}). Flèches gauche et droite pour lire chaque point.`}
          tabIndex={0}
          className="block outline-none focus-visible:ring-1 focus-visible:ring-gray-600 rounded"
          onPointerMove={(e) => setActive(indexAt(e.clientX))}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((v) => v ?? points.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setActive((v) => Math.max(0, (v ?? points.length - 1) - 1));
            if (e.key === 'ArrowRight') setActive((v) => Math.min(points.length - 1, (v ?? 0) + 1));
          }}
        >
          {/* Grille : 3 traits fins, pleins */}
          {yTicks.filter((v) => v > 0).map((v) => (
            <line key={v} x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
          ))}
          <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} stroke={AXIS} strokeWidth={1} />
          {yTicks.map((v) => (
            <text key={v} x={PAD.left - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill={MUTED} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {fmt(v)}
            </text>
          ))}

          {/* Repères (ex. début de la carte principale) */}
          {sortedMarkers.map((m, k) => {
            const anchor = markerAnchor(k);
            const dx = anchor === 'start' ? 4 : anchor === 'end' ? -4 : 0;
            return (
              <g key={m.label}>
                <line x1={x(m.index)} x2={x(m.index)} y1={PAD.top - 6} y2={y(0)} stroke={MARKER} strokeWidth={1} />
                <text x={x(m.index) + dx} y={PAD.top - 12} textAnchor={anchor} fontSize={11} fill={MUTED}>{m.label}</text>
              </g>
            );
          })}

          <path d={area} fill={LINE} fillOpacity={0.1} />
          <path d={line} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* Pic étiqueté */}
          {active === null && (
            <g>
              <circle cx={x(peak)} cy={y(points[peak].n)} r={4} fill={LINE} stroke={SURFACE} strokeWidth={2} />
              {markers.length === 0 && (
                <text x={x(peak)} y={y(points[peak].n) - 10} textAnchor="middle" fontSize={11} fill="#e5e7eb">
                  pic {fmt(points[peak].n)}
                </text>
              )}
            </g>
          )}

          {/* Axe X : quelques libellés espacés */}
          {points.map((p, i) =>
            showAxis(i) ? (
              <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize={11} fill={MUTED}>{p.axis}</text>
            ) : null
          )}

          {/* Ligne verticale qui suit la souris */}
          {active !== null && (
            <g pointerEvents="none">
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={y(0)} stroke={MARKER} strokeWidth={1} />
              <circle cx={x(active)} cy={y(points[active].n)} r={4} fill={LINE} stroke={SURFACE} strokeWidth={2} />
            </g>
          )}
        </svg>

        {a && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md bg-gray-800 border border-gray-700 px-2 py-1 text-xs shadow-lg whitespace-nowrap"
            style={{ left: tipLeft }}
          >
            <span className="text-white font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(a.n)}</span>
            <span className="text-gray-400"> {unit} · {a.tip}</span>
          </div>
        )}
      </div>

      <details className="mt-2 text-xs text-gray-500">
        <summary className="cursor-pointer hover:text-gray-300">Voir les chiffres</summary>
        <table className="mt-2 w-full max-w-sm">
          <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
            {points.map((p, i) => (
              <tr key={i} className="border-b border-gray-800/60">
                <td className="py-1 pr-4 text-gray-400">{p.tip}</td>
                <td className="py-1 text-right text-gray-200">{fmt(p.n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
