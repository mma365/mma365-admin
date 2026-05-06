import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split('T')[0];

  const [{ count: totalEvents }, { count: totalFighters }, { count: upcomingEvents }] = await Promise.all([
    supabase.from('events').select('*', { count: 'exact', head: true }),
    supabase.from('fighters').select('*', { count: 'exact', head: true }),
    supabase.from('events').select('*', { count: 'exact', head: true }).gte('date', today),
  ]);

  const stats = [
    { label: 'Events total', value: totalEvents ?? 0 },
    { label: 'Fighters', value: totalFighters ?? 0 },
    { label: 'Events à venir', value: upcomingEvents ?? 0 },
  ];

  return (
    <div>
      <h1 className="text-white text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-sm mb-1">{s.label}</p>
            <p className="text-white text-3xl font-bold">{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
