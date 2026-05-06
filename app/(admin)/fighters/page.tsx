import { createAdminClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Suspense } from 'react';
import SearchBar from '@/components/SearchBar';
import Pagination from '@/components/Pagination';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function FightersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = '', page: pageParam = '1' } = await searchParams;
  const page = Math.max(1, parseInt(pageParam, 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = createAdminClient();

  let query = supabase
    .from('fighters')
    .select('id, first_name, last_name, organization, weight_class, country, wins, losses, draws', { count: 'exact' })
    .order('last_name', { ascending: true });

  if (q.trim()) {
    query = query.or(`first_name.ilike.%${q.trim()}%,last_name.ilike.%${q.trim()}%`);
  }

  const { data: fighters, count } = await query.range(from, from + PAGE_SIZE - 1);

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  function buildHref(p: number) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (p > 1) params.set('page', String(p));
    return `/fighters?${params.toString()}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-white text-2xl font-bold">Fighters</h1>
        <div className="flex items-center gap-3">
          <Suspense>
            <SearchBar defaultValue={q} placeholder="Rechercher un fighter..." />
          </Suspense>
          <Link
            href="/fighters/new"
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            + Nouveau fighter
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
              <th className="text-left text-gray-400 font-medium px-4 py-3">Nom</th>
              <th className="text-left text-gray-400 font-medium px-4 py-3">Org</th>
              <th className="text-left text-gray-400 font-medium px-4 py-3">Division</th>
              <th className="text-left text-gray-400 font-medium px-4 py-3">Pays</th>
              <th className="text-left text-gray-400 font-medium px-4 py-3">Bilan</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {fighters?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Aucun résultat.
                </td>
              </tr>
            )}
            {fighters?.map((f: {
              id: string;
              first_name: string;
              last_name: string;
              organization: string;
              weight_class: string;
              country: string;
              wins: number;
              losses: number;
              draws: number;
            }) => (
              <tr key={f.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3 text-white font-medium">
                  {f.first_name} {f.last_name}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">{f.organization}</span>
                </td>
                <td className="px-4 py-3 text-gray-400">{f.weight_class}</td>
                <td className="px-4 py-3 text-gray-400">{f.country}</td>
                <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                  {f.wins}-{f.losses}-{f.draws}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/fighters/${f.id}`} className="text-red-400 hover:text-red-300 text-xs">
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
