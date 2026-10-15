/**
 * Semaine type (page Stats) : 7 lignes (lundi → dimanche) × 24 colonnes (heures, Bangkok).
 * Une seule teinte, plus claire = plus d'activité (5 niveaux), case vide = gris. Les cases où
 * tombe un event de la période (carte principale) ont un contour blanc. Survol / focus : le
 * détail de la case ; la liste des events et « Voir les chiffres » rendent tout lisible sans survol.
 */
import { fmt } from './charts';

// Rampe séquentielle bleue (palette de référence, pas plus sombre que 600 sur fond sombre).
const RAMP = ['#184f95', '#256abf', '#3987e5', '#6da7ec', '#b7d3f6'];
const EMPTY = '#1f2937'; // gray-800

const DAYS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

export type HeatCell = { dow: number; hour: number; n: number };
/** at / hour null : event sans heure connue, placé sur le jour entier (point à côté du jour). */
export type HeatEvent = { id: string; label: string; detail: string; date: string; at: string | null; dow: number; hour: number | null };

const h2 = (h: number) => String(h).padStart(2, '0');
const eventDateFmt = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Asia/Bangkok', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});
const dayOnlyFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit' });

function eventWhen(e: HeatEvent): string {
  return e.at ? eventDateFmt.format(new Date(e.at)) : `${dayOnlyFmt.format(new Date(`${e.date}T12:00:00Z`))} · heure inconnue`;
}

export default function Heatmap({ cells, events }: { cells: HeatCell[]; events: HeatEvent[] }) {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const c of cells) if (c.dow >= 1 && c.dow <= 7 && c.hour >= 0 && c.hour < 24) grid[c.dow - 1][c.hour] = c.n;
  const max = Math.max(0, ...cells.map((c) => c.n));

  const eventsAt = new Map<string, HeatEvent[]>();   // « jour-heure » → events à cette heure
  const dayOnly = new Map<number, HeatEvent[]>();    // jour → events sans heure connue
  for (const e of events) {
    if (e.hour === null) {
      dayOnly.set(e.dow, [...(dayOnly.get(e.dow) ?? []), e]);
    } else {
      const key = `${e.dow}-${e.hour}`;
      eventsAt.set(key, [...(eventsAt.get(key) ?? []), e]);
    }
  }

  const color = (n: number) => (n === 0 || max === 0 ? EMPTY : RAMP[Math.min(4, Math.ceil((n / max) * 5) - 1)]);
  const busiest = cells.filter((c) => c.n > 0).sort((a, b) => b.n - a.n);

  return (
    <div>
      {max === 0 && <p className="text-gray-500 text-sm mb-3">Aucune activité sur la période.</p>}

      <div className="grid gap-[2px]" style={{ gridTemplateColumns: '2.75rem repeat(24, minmax(0, 1fr))' }}>
        {/* En-tête des heures : une sur trois */}
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-[10px] text-gray-500 text-center" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {h % 3 === 0 ? `${h2(h)}h` : ''}
          </span>
        ))}

        {grid.map((row, d) => {
          const noTime = dayOnly.get(d + 1) ?? [];
          return (
          <div key={d} className="contents">
            {noTime.length === 0 ? (
              <span className="text-xs text-gray-400 self-center">{DAYS[d]}</span>
            ) : (
              <span
                tabIndex={0}
                aria-label={`${DAYS[d]} : event sans heure connue · ${noTime.map((e) => e.label).join(', ')}`}
                className="group relative text-xs text-gray-400 self-center flex items-center gap-1 outline-none cursor-default"
              >
                {DAYS[d]}
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                <span className="pointer-events-none absolute bottom-full left-0 mb-1 hidden group-hover:block group-focus:block z-10 whitespace-nowrap rounded-md bg-gray-800 border border-gray-700 px-2 py-1 text-xs shadow-lg">
                  <span className="text-gray-400">Ce jour-là, heure inconnue :</span>
                  {noTime.map((e) => (
                    <span key={e.id} className="block text-gray-200">{e.label}</span>
                  ))}
                </span>
              </span>
            )}
            {row.map((n, h) => {
              const evs = eventsAt.get(`${d + 1}-${h}`) ?? [];
              return (
                <div
                  key={h}
                  tabIndex={0}
                  aria-label={`${DAYS[d]} ${h2(h)} h : ${fmt(n)} actions${evs.length ? ` · ${evs.map((e) => e.label).join(', ')}` : ''}`}
                  className={`group relative h-6 rounded-[3px] outline-none hover:brightness-125 focus:brightness-125 ${
                    evs.length ? 'ring-2 ring-inset ring-white' : ''
                  }`}
                  style={{ background: color(n) }}
                >
                  <div
                    className={`pointer-events-none absolute bottom-full mb-1 hidden group-hover:block group-focus:block z-10 whitespace-nowrap rounded-md bg-gray-800 border border-gray-700 px-2 py-1 text-xs shadow-lg ${
                      h > 16 ? 'right-0' : 'left-0'
                    }`}
                  >
                    <span className="text-white font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(n)}</span>
                    <span className="text-gray-400"> actions · {DAYS[d]} {h2(h)} h – {h2((h + 1) % 24)} h</span>
                    {evs.map((e) => (
                      <div key={e.id} className="text-gray-200">{e.label}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          );
        })}
      </div>

      {/* Légende */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          moins
          <span className="h-3 w-3 rounded-[2px]" style={{ background: EMPTY }} />
          {RAMP.map((c) => <span key={c} className="h-3 w-3 rounded-[2px]" style={{ background: c }} />)}
          plus
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[2px] ring-2 ring-inset ring-white" style={{ background: EMPTY }} />
          heure d’un event (carte principale)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          event ce jour-là, heure inconnue
        </span>
      </div>

      {/* Events de la période, lisibles sans survol */}
      <div className="mt-4">
        <p className="text-gray-400 text-xs mb-1">Events de la période</p>
        {events.length === 0 ? (
          <p className="text-gray-500 text-xs">Aucun event sur la période.</p>
        ) : (
          <ul className="text-xs text-gray-300 flex flex-col gap-0.5">
            {events.map((e) => (
              <li key={e.id}>
                <span className="text-gray-500">{eventWhen(e)}</span> · {e.label}
                <span className="text-gray-500"> ({e.detail})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <details className="mt-3 text-xs text-gray-500">
        <summary className="cursor-pointer hover:text-gray-300">Voir les chiffres</summary>
        <table className="mt-2 w-full max-w-sm">
          <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
            {busiest.map((c) => (
              <tr key={`${c.dow}-${c.hour}`} className="border-b border-gray-800/60">
                <td className="py-1 pr-4 text-gray-400">{DAYS[c.dow - 1]} {h2(c.hour)} h – {h2((c.hour + 1) % 24)} h</td>
                <td className="py-1 text-right text-gray-200">{fmt(c.n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
