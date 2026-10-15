import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { Card, RankList, StatTile, dailyPoints, fmt, type RankRow } from './charts';
import LineChart from './LineChart';
import Heatmap, { type HeatCell, type HeatEvent } from './Heatmap';

export const dynamic = 'force-dynamic';

// Tous les chiffres viennent d'une seule fonction SQL (docs/sql/admin_stats.sql).
type Stats = {
  days: number;
  lang: 'all' | 'fr' | 'en';
  first: string;
  devices: { total: number; new: number; active7: number; ios: number; android: number; by_day: { day: string; n: number }[] };
  usage: { views: number; searches: number; notif_opens: number; by_day: { day: string; n: number }[] };
  top_fighters: RankRow[];
  top_events: RankRow[];
  top_fights: RankRow[];
  top_articles: RankRow[];
  sources: RankRow[];
  searches: { selects: number; empties: number; top_queries: RankRow[]; top_empty: RankRow[] };
  notifs: { type: string; envois: number; remis: number | null; ouvertures: number }[];
  favorites: { fighters: RankRow[]; events: RankRow[]; fights: RankRow[] };
  no_photo: RankRow[];
  heatmap: HeatCell[];
  heatmap_events: HeatEvent[];
};

const PERIODS = [7, 30, 90];
const LANGS = [
  { key: 'all', label: 'Toutes langues' },
  { key: 'fr', label: 'FR' },
  { key: 'en', label: 'EN' },
] as const;

const SOURCE_LABELS: Record<string, string> = {
  home: 'Accueil', search: 'Recherche', favorites: 'Favoris', rankings: 'Classements', actus: 'Actus',
  notif: 'Notification', event: 'Page event', fight: 'Page combat', fighter: 'Fiche combattant',
  gym: 'Salle', article: 'Article', other: 'Autre',
};

const NOTIF_LABELS: Record<string, string> = {
  new_fight: 'Nouveau combat (favoris)',
  title_fight: 'Combat pour une ceinture',
  fight_cancelled: 'Combat annulé',
  fight_result: 'Résultat de combat',
  event_completed: 'Event terminé',
  event_starting: 'Rappel avant event (local)',
  rankings_updated: 'Classements mis à jour',
  ranking_change: 'Changement de classement (favori)',
  new_article: 'Nouvel article',
  broadcast: 'Message admin',
  new_org: 'Nouvelle organisation',
  events_today_digest: 'Résumé du jour (ancien)',
  event_today: 'Event du jour (ancien)',
};

function pct(part: number, whole: number): string {
  if (!whole) return '—';
  return `${((part / whole) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; lang?: string; internal?: string }>;
}) {
  const params = await searchParams;
  const days = PERIODS.includes(Number(params.days)) ? Number(params.days) : 30;
  const lang = LANGS.some((l) => l.key === params.lang) ? (params.lang as Stats['lang']) : 'all';
  const internal = params.internal === '1';

  function href(change: Partial<{ days: number; lang: string; internal: boolean }>) {
    const next = { days, lang, internal, ...change };
    const q = new URLSearchParams();
    if (next.days !== 30) q.set('days', String(next.days));
    if (next.lang !== 'all') q.set('lang', next.lang);
    if (next.internal) q.set('internal', '1');
    const s = q.toString();
    return s ? `/stats?${s}` : '/stats';
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('admin_stats', {
    p_days: days,
    p_lang: lang,
    p_include_internal: internal,
  });
  const stats = data as Stats | null;

  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-sm transition-colors ${
      active ? 'bg-red-600/20 text-red-400 font-medium' : 'text-gray-400 hover:text-white hover:bg-gray-800'
    }`;

  return (
    <div className="max-w-6xl">
      <h1 className="text-white text-2xl font-bold">Stats</h1>
      <p className="text-gray-500 text-sm mt-1">
        Compteurs anonymes de l’app (depuis l’OTA du 15/10/2026, versions 1.5.0 et plus) et appareils inscrits aux notifications.
        Jours et heures à l’heure de Bangkok.
      </p>

      {/* Une seule rangée de filtres, qui s'applique à toute la page */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-5 mb-6">
        <div className="flex items-center gap-1">
          {PERIODS.map((p) => (
            <Link key={p} href={href({ days: p })} className={pill(p === days)}>{p} jours</Link>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {LANGS.map((l) => (
            <Link key={l.key} href={href({ lang: l.key })} className={pill(l.key === lang)}>{l.label}</Link>
          ))}
        </div>
        <Link href={href({ internal: !internal })} className={pill(internal)}>
          {internal ? '✓ ' : ''}Inclure mes données (tampon interne)
        </Link>
      </div>

      {error || !stats ? (
        <div className="bg-gray-900 border border-red-900/50 rounded-xl p-5 text-sm">
          <p className="text-red-400 font-medium">Impossible de charger les stats.</p>
          <p className="text-gray-400 mt-1">
            La fonction <code className="text-gray-300">admin_stats</code> est-elle en base ? Colle{' '}
            <code className="text-gray-300">docs/sql/admin_stats.sql</code> dans le SQL Editor de Supabase.
          </p>
          {error && <p className="text-gray-500 mt-2 text-xs">{error.message}</p>}
        </div>
      ) : (
        <StatsBody stats={stats} />
      )}
    </div>
  );
}

function StatsBody({ stats }: { stats: Stats }) {
  const { devices, usage, searches } = stats;
  const langNote = stats.lang === 'all' ? '' : ` · ${stats.lang.toUpperCase()}`;
  const searchTotal = searches.selects + searches.empties;
  const notifsByLang = stats.lang !== 'all';

  return (
    <div className="flex flex-col gap-8">
      {/* ── Audience ───────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-3">Audience{langNote}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatTile
            label="Appareils inscrits aux notifications"
            value={fmt(devices.total)}
            hint={`iOS ${fmt(devices.ios)} · Android ${fmt(devices.android)}`}
          />
          <StatTile label={`Nouveaux sur ${stats.days} jours`} value={fmt(devices.new)} hint="Premier enregistrement du token" />
          <StatTile label="Actifs sur 7 jours" value={fmt(devices.active7)} hint="App ouverte (réinscription ≤ 24 h)" />
        </div>
        <div className="mt-4">
          <Card
            title="Nouveaux appareils par jour"
            subtitle="Approximation des téléchargements : sans autorisation de notifications pas de token, une réinstallation compte deux fois. Les vrais téléchargements sont dans App Store Connect / Play Console."
          >
            <LineChart points={dailyPoints(devices.by_day)} unit="nouveaux appareils" />
          </Card>
        </div>
      </div>

      {/* ── Usage ──────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-3">Usage{langNote}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatTile label="Fiches ouvertes" value={fmt(usage.views)} hint="Combattants, events, combats, articles" />
          <StatTile label="Recherches" value={fmt(usage.searches)} hint={`Taux de choix ${pct(searches.selects, searchTotal)}`} />
          <StatTile label="Notifications ouvertes" value={fmt(usage.notif_opens)} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          <div className="lg:col-span-2">
            <Card
              title="Activité dans l’app par jour"
              subtitle="Fiches ouvertes, recherches et notifs touchées. Les simples ouvertures de l’app ne sont pas encore comptées."
            >
              <LineChart points={dailyPoints(usage.by_day)} unit="actions" />
            </Card>
          </div>
          <Card title="D’où viennent les ouvertures" subtitle="Écran depuis lequel la fiche a été ouverte">
            <RankList rows={stats.sources.map((s) => ({ ...s, label: SOURCE_LABELS[s.label] ?? s.label }))} />
          </Card>
        </div>
      </div>

      {/* ── Semaine type ───────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-3">Semaine type{langNote}</h2>
        <Card
          title="Activité par jour et par heure (heure de Bangkok)"
          subtitle={`Toutes les semaines des ${stats.days} derniers jours additionnées. Plus la case est claire, plus il y a d’activité à ce moment-là.`}
        >
          <Heatmap cells={stats.heatmap} events={stats.heatmap_events} />
        </Card>
      </div>

      {/* ── Favoris ────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-1">Favoris{langNote}</h2>
        <p className="text-gray-500 text-xs mb-3">
          Ce qui est en favori aujourd’hui sur les appareils inscrits aux notifications (la période ne s’applique pas).
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card title="Combattants">
            <RankList rows={stats.favorites.fighters} href={(r) => (r.id ? `/fighters/${r.id}` : null)} />
          </Card>
          <Card title="Events">
            <RankList rows={stats.favorites.events} href={(r) => (r.id ? `/events/${r.id}` : null)} />
          </Card>
          <Card title="Combats">
            <RankList rows={stats.favorites.fights} />
          </Card>
        </div>
      </div>

      {/* ── Photos à chercher ──────────────────────────────────────────────── */}
      <div>
        <h2 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-3">Photos à chercher en priorité{langNote}</h2>
        <Card
          title="Fiches très consultées qui s’affichent sans photo"
          subtitle="Ces combattants n’ont que leurs initiales dans l’app. Les plus vus d’abord."
        >
          <RankList
            rows={stats.no_photo}
            empty="Toutes les fiches consultées ont une photo."
            href={(r) => (r.id ? `/fighters/${r.id}` : null)}
          />
        </Card>
      </div>

      {/* ── Intérêt ────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-3">Ce qui intéresse{langNote}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Combattants les plus consultés">
            <RankList rows={stats.top_fighters} href={(r) => (r.id ? `/fighters/${r.id}` : null)} />
          </Card>
          <Card title="Events les plus consultés">
            <RankList rows={stats.top_events} href={(r) => (r.id ? `/events/${r.id}` : null)} />
          </Card>
          <Card title="Combats les plus consultés">
            <RankList rows={stats.top_fights} />
          </Card>
          <Card title="Articles les plus lus" subtitle="Dans l’app (le site web n’est pas compté)">
            <RankList rows={stats.top_articles} />
          </Card>
        </div>
      </div>

      {/* ── Recherche ──────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-3">Recherche{langNote}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Recherches qui aboutissent" subtitle="Texte tapé avant de choisir un résultat">
            <RankList rows={stats.searches.top_queries} />
          </Card>
          <Card title="Recherches sans résultat" subtitle="Combattants ou events qui manquent peut-être dans la base">
            <RankList rows={stats.searches.top_empty} />
          </Card>
        </div>
      </div>

      {/* ── Notifications ──────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-3">Notifications{langNote}</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-left font-medium px-4 py-3">Type</th>
                <th className="text-right font-medium px-4 py-3">Envois</th>
                <th className="text-right font-medium px-4 py-3">Appareils remis</th>
                <th className="text-right font-medium px-4 py-3">Ouvertures</th>
                <th className="text-right font-medium px-4 py-3">Taux d’ouverture</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {stats.notifs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Aucune notification sur la période.</td></tr>
              )}
              {stats.notifs.map((n) => (
                <tr key={n.type} className="border-b border-gray-800/50">
                  <td className="px-4 py-3 text-gray-200">{NOTIF_LABELS[n.type] ?? n.type}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{n.envois ? fmt(n.envois) : '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmt(n.remis)}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmt(n.ouvertures)}</td>
                  <td className="px-4 py-3 text-right text-white font-medium">
                    {notifsByLang || !n.remis ? '—' : pct(n.ouvertures, n.remis)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-gray-500 text-xs mt-2">
          Envois et appareils remis : notifications serveur, toutes langues (le journal d’envoi ne garde pas la langue)
          {notifsByLang ? ', donc pas de taux quand un filtre de langue est actif' : ''}. « Appareils remis » n’existe que
          pour les envois faits après la mise à jour des scrapers. Les rappels locaux n’ont que des ouvertures. Les
          utilisateurs en 1.4 reçoivent les notifs mais leurs ouvertures ne remontent pas : le taux est un peu sous-estimé.
        </p>
      </div>
    </div>
  );
}
