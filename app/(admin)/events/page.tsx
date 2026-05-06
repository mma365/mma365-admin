import { createAdminClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Suspense } from 'react';
import SearchBar from '@/components/SearchBar';
import Pagination from '@/components/Pagination';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = '', page: pageParam = '1' } = await searchParams;
  const page = Math.max(1, parseInt(pageParam, 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = createAdminClient();

  let query = supabase
    .from('events')
    .select('id, name, date, organization', { count: 'exact' })
    .order('date', { ascending: false });

  if (q.trim()) {
    query = query.or(`name.ilike.%${q.trim()}%,organization.ilike.%${q.trim()}%`);
  }

  const { data: events, count } = await query.range(from, from + PAGE_SIZE - 1);

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  function buildHref(p: number) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (p > 1) params.set('page', String(p));
    return `/events?${params.toString()}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-white text-2xl font-bold">Events</h1>
        <div className="flex items-center gap-3">
          <Suspense>
            <SearchBar defaultValue={q} placeholder="Rechercher un event..." />
          </Suspense>
          <Link
            href="/events/new"
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            + Nouvel event
          </Link>
        </div>
      </div>

      <p className="text-gray-500 text-sm mb-3">
        {count ?? 0} résultat{(count ?? 0) > 1 ? 's' : ''}
        {q ? ` pour "${q}"` : ''}
        {totalPages > 1 ? ` — page ${page}/${totalPages}` : ''}
      </p>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-gray-400 font-medium px-4 py-3">Date</th>
              <th className="text-left text-gray-400 font-medium px-4 py-3">Nom</th>
              <th className="text-left text-gray-400 font-medium px-4 py-3">Org</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {events?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Aucun résultat.
                </td>
              </tr>
            )}
            {events?.map((event: { id: string; name: string; date: string; organization: string }) => (
              <tr key={event.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{event.date}</td>
                <td className="px-4 py-3 text-white">{event.name}</td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">{event.organization}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/events/${event.id}`} className="text-red-400 hover:text-red-300 text-xs">
                    Éditer →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}
