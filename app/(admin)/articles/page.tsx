import { createAdminClient } from '@/lib/supabase/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const TYPE_LABELS: Record<string, string> = {
  preview: '🔮 Preview',
  focus: '🥊 Focus',
  portrait: '👤 Portrait',
  libre: '📝 Libre',
};

function ChannelPill({ label, done, doneLabel }: { label: string; done: boolean; doneLabel?: string }) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded ${
        done ? 'bg-green-600/20 text-green-400' : 'bg-gray-800 text-gray-500'
      }`}
    >
      {done ? `${label} ✓${doneLabel ? ` ${doneLabel}` : ''}` : label}
    </span>
  );
}

export default async function ArticlesPage() {
  const supabase = createAdminClient();

  const today = new Date().toISOString().split('T')[0];
  const inTenDays = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];

  const [{ data: articles }, { data: upcomingEvents }] = await Promise.all([
    supabase
      .from('articles')
      .select('id, type, status, source, title_fr, slug, created_at, published_web_at, insta_posted_at, event_id, fighter_id')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('events')
      .select('id, name, date, organization')
      .gte('date', today)
      .lte('date', inTenDays)
      .order('date', { ascending: true })
      .limit(8),
  ]);

  type ArticleRow = {
    id: string; type: string; status: string; source: string; title_fr: string;
    slug: string | null; created_at: string; published_web_at: string | null;
    insta_posted_at: string | null; event_id: string | null; fighter_id: string | null;
  };
  type EventRow = { id: string; name: string; date: string; organization: string };

  // Events à venir sans preview déjà rédigée → suggestions
  const coveredEventIds = new Set((articles as ArticleRow[] | null)?.filter((a) => a.type === 'preview').map((a) => a.event_id));
  const suggestions = ((upcomingEvents ?? []) as EventRow[]).filter((e) => !coveredEventIds.has(e.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-white text-2xl font-bold">Articles</h1>
        <Link
          href="/articles/new"
          className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Nouvel article
        </Link>
      </div>

      {suggestions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-gray-400 text-sm font-medium mb-3">
            Suggestions · events des 10 prochains jours sans preview
          </h2>
          <div className="grid gap-2">
            {suggestions.map((event) => (
              <div
                key={event.id}
                className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded shrink-0">{event.organization}</span>
                  <span className="text-white text-sm truncate">{event.name}</span>
                  <span className="text-gray-500 text-xs shrink-0">{event.date}</span>
                </div>
                <Link
                  href={`/articles/new?type=preview&eventId=${event.id}&eventLabel=${encodeURIComponent(event.name)}`}
                  className="text-red-400 hover:text-red-300 text-xs whitespace-nowrap ml-3"
                >
                  Générer la preview →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-gray-400 text-sm font-medium mb-3">Tous les articles</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-gray-400 font-medium px-4 py-3">Titre</th>
              <th className="text-left text-gray-400 font-medium px-4 py-3">Type</th>
              <th className="text-left text-gray-400 font-medium px-4 py-3">Canaux</th>
              <th className="text-left text-gray-400 font-medium px-4 py-3">Créé</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(!articles || articles.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Aucun article. Lance-toi avec « + Nouvel article ».
                </td>
              </tr>
            )}
            {(articles as ArticleRow[] | null)?.map((article) => (
              <tr key={article.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3 text-white max-w-md truncate">
                  {article.title_fr || <span className="text-gray-500 italic">Sans titre</span>}
                  {article.source === 'pipeline' && (
                    <span className="ml-2 text-xs text-gray-500">⚙️ auto</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{TYPE_LABELS[article.type] ?? article.type}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <ChannelPill label="Web" done={Boolean(article.published_web_at)} />
                    <ChannelPill label="Insta" done={Boolean(article.insta_posted_at)} />
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{article.created_at.slice(0, 10)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/articles/${article.id}`} className="text-red-400 hover:text-red-300 text-xs">
                    Éditer →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
