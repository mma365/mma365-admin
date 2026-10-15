/**
 * Grille d'une semaine (page Stats), comme un agenda : 7 colonnes (lun. 13 → dim. 19) × 24
 * lignes (heures, Bangkok). Une seule teinte, plus claire = plus d'activité (5 niveaux, relatifs au maximum de
 * la semaine), case vide = gris. Contour blanc : heure de la carte principale d'un event ; point
 * blanc à côté du jour : event ce jour-là sans heure connue. Survol / focus : le détail de la
 * case ; la liste des events et « Voir les chiffres » rendent tout lisible sans survol.
 */
import { fmt } from './charts';

// Rampe séquentielle bleue (palette de référence, pas plus sombre que 600 sur fond sombre).
const RAMP = ['#184f95', '#256abf', '#3987e5', '#6da7ec', '#b7d3f6'];
const EMPTY = '#1f2937'; // gray-800

const DAYS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

export type HeatCell = { dow: number; hour: number; n: number };
/** at / hour null : event sans heure connue, placé sur le jour entier (point à côté du jour). */
export type HeatEvent = { id: string; label: string; detail: string; date: string; at: string | null; dow: number; hour: number | null };
export type WeekHeatmap = { week_start: string; today: string; cells: HeatCell[]; events: HeatEvent[] };

/** Date ISO (« 2026-10-13 ») + n jours. */
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const h2 = (h: number) => String(h).padStart(2, '0');
const eventTimeFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });

export default function Heatmap({ week }: { week: WeekHeatmap }) {
  const { cells, events } = week;
  const dates = Array.from({ length: 7 }, (_, d) => addDays(week.week_start, d));
  const dayLabel = (d: number) => `${DAYS[d]} ${Number(dates[d].slice(8))}`;

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
  const tooltip = 'pointer-events-none absolute bottom-full mb-1 hidden group-hover:block group-focus:block z-10 whitespace-nowrap rounded-md bg-gray-800 border border-gray-700 px-2 py-1 text-xs shadow-lg';

  return (
    <div>
      {max === 0 && <p className="text-gray-500 text-sm mb-3">Aucune activité cette semaine.</p>}

      {/* Comme un agenda : jours en colonnes (lundi → dimanche), heures en lignes (00 h → 23 h) */}
      <div className="grid gap-[2px] max-w-3xl" style={{ gridTemplateColumns: '2.5rem repeat(7, minmax(0, 1fr))' }}>
        {/* En-tête : les jours, avec un point quand un event du jour n'a pas d'heure */}
        <span />
        {dates.map((_, d) => {
          const noTime = dayOnly.get(d + 1) ?? [];
          const isToday = dates[d] === week.today;
          const labelClass = `text-xs pb-1 flex items-center justify-center gap-1 ${isToday ? 'text-white font-semibold' : 'text-gray-400'}`;
          if (noTime.length === 0) return <span key={d} className={labelClass}>{dayLabel(d)}</span>;
          return (
            <span
              key={d}
              tabIndex={0}
              aria-label={`${dayLabel(d)} : event sans heure connue · ${noTime.map((e) => e.label).join(', ')}`}
              className={`group relative outline-none cursor-default ${labelClass}`}
            >
              {dayLabel(d)}
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              <span className={`${tooltip} ${d >= 4 ? 'right-0' : 'left-0'}`}>
                <span className="text-gray-400">Ce jour-là, heure inconnue :</span>
                {noTime.map((e) => (
                  <span key={e.id} className="block text-gray-200">{e.label}</span>
                ))}
              </span>
            </span>
          );
        })}

        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="contents">
            <span className="text-[10px] text-gray-500 text-right pr-1 self-center" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {`${h2(h)} h`}
            </span>
            {grid.map((row, d) => {
              const n = row[h];
              const evs = eventsAt.get(`${d + 1}-${h}`) ?? [];
              return (
                <div
                  key={d}
                  tabIndex={0}
                  aria-label={`${dayLabel(d)} ${h2(h)} h : ${fmt(n)} actions${evs.length ? ` · ${evs.map((e) => e.label).join(', ')}` : ''}`}
                  className={`group relative h-5 rounded-[3px] outline-none hover:brightness-125 focus:brightness-125 ${
                    evs.length ? 'ring-2 ring-inset ring-white' : ''
                  }`}
                  style={{ background: color(n) }}
                >
                  <div className={`${tooltip} ${d >= 4 ? 'right-0' : 'left-0'}`}>
                    <span className="text-white font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(n)}</span>
                    <span className="text-gray-400"> actions · {dayLabel(d)} · {h2(h)} h – {h2((h + 1) % 24)} h</span>
                    {evs.map((e) => (
                      <div key={e.id} className="text-gray-200">{e.label}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
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

      {/* Events de la semaine, lisibles sans survol */}
      <div className="mt-4">
        <p className="text-gray-400 text-xs mb-1">Events de la semaine</p>
        {events.length === 0 ? (
          <p className="text-gray-500 text-xs">Aucun event cette semaine.</p>
        ) : (
          <ul className="text-xs text-gray-300 flex flex-col gap-0.5">
            {events.map((e) => (
              <li key={e.id}>
                <span className="text-gray-500">
                  {dayLabel(e.dow - 1)} · {e.at ? eventTimeFmt.format(new Date(e.at)) : 'heure inconnue'}
                </span>{' '}
                · {e.label}
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
                <td className="py-1 pr-4 text-gray-400">{dayLabel(c.dow - 1)} · {h2(c.hour)} h – {h2((c.hour + 1) % 24)} h</td>
                <td className="py-1 text-right text-gray-200">{fmt(c.n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
