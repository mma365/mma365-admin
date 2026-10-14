/**
 * Briques de la page Stats — composants serveur, sans librairie de graphiques.
 * Une seule série par graphique → une seule couleur (bleu, validé ≥ 3:1 sur gray-900),
 * pas de légende : le titre du bloc dit ce qui est tracé. Chaque valeur reste lisible
 * sans survol (étiquettes, listes chiffrées) ; l'infobulle ne fait qu'enrichir.
 */

const BAR = '#3987e5';

export function fmt(n: number | null | undefined): string {
  return n == null ? '—' : n.toLocaleString('fr-FR');
}

function fmtDay(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h2 className="text-white text-sm font-semibold">{title}</h2>
      {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-gray-400 text-sm">{label}</p>
      <p className="text-white text-3xl font-semibold mt-1">{value}</p>
      {hint && <p className="text-gray-500 text-xs mt-1">{hint}</p>}
    </div>
  );
}

/** Colonnes par jour : barres ≤ 24 px, bout arrondi 4 px, 2 px d'espace, maximum étiqueté. */
export function DailyColumns({ data, unit }: { data: { day: string; n: number }[]; unit: string }) {
  const max = Math.max(0, ...data.map((d) => d.n));
  if (max === 0) return <p className="text-gray-500 text-sm py-6">Aucune donnée sur la période.</p>;
  const total = data.reduce((s, d) => s + d.n, 0);
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs text-gray-500 mb-2 tabular-nums">
        <span>max {fmt(max)} {unit} / jour</span>
        <span>total {fmt(total)}</span>
      </div>
      <div className="flex items-end gap-[2px] h-36 border-b border-gray-700">
        {data.map((d) => (
          <div
            key={d.day}
            tabIndex={0}
            aria-label={`${fmtDay(d.day)} : ${fmt(d.n)} ${unit}`}
            className="group relative flex-1 h-full flex items-end justify-center outline-none"
          >
            <div
              className="w-full max-w-6 rounded-t-[4px] group-hover:brightness-125 group-focus:brightness-125"
              style={{ height: d.n === 0 ? 0 : `${Math.max(2, (d.n / max) * 100)}%`, background: BAR }}
            />
            <div className="pointer-events-none absolute bottom-full mb-1 hidden group-hover:block group-focus:block z-10 whitespace-nowrap rounded-md bg-gray-800 border border-gray-700 px-2 py-1 text-xs shadow-lg">
              <span className="text-white font-semibold tabular-nums">{fmt(d.n)}</span>
              <span className="text-gray-400"> {unit} · {fmtDay(d.day)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1 tabular-nums">
        <span>{fmtDay(data[0].day)}</span>
        <span>{fmtDay(data[data.length - 1].day)}</span>
      </div>
    </div>
  );
}

export type RankRow = { id?: string; label: string; detail?: string | null; n: number };

/** Classement : barre horizontale proportionnelle + valeur au bout (la liste est aussi le tableau). */
export function RankList({ rows, empty = 'Rien pour l’instant.', href }: {
  rows: RankRow[];
  empty?: string;
  href?: (row: RankRow) => string | null;
}) {
  if (rows.length === 0) return <p className="text-gray-500 text-sm py-2">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.n));
  return (
    <ol className="flex flex-col gap-2">
      {rows.map((r, i) => {
        const link = href?.(r) ?? null;
        const label = (
          <span className="text-gray-200 truncate" title={r.label}>{r.label}</span>
        );
        return (
          <li key={`${r.id ?? r.label}-${i}`} className="grid grid-cols-[1.25rem_minmax(0,1fr)_minmax(0,40%)] items-center gap-3 text-sm">
            <span className="text-gray-500 text-xs tabular-nums text-right">{i + 1}</span>
            <span className="flex flex-col min-w-0">
              {link ? <a href={link} className="hover:underline min-w-0 flex">{label}</a> : label}
              {r.detail && <span className="text-gray-500 text-xs truncate">{r.detail}</span>}
            </span>
            <span className="flex items-center gap-2">
              <span className="flex-1 min-w-0">
                <span className="block h-2.5 rounded-r-[4px]" style={{ width: `${Math.max(2, (r.n / max) * 100)}%`, background: BAR }} />
              </span>
              <span className="w-12 text-right text-gray-300 text-xs tabular-nums">{fmt(r.n)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
