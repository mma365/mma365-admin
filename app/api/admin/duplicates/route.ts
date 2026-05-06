import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createAdminClient();

  // Find events sharing the same (name, date) regardless of case/spacing
  const { data, error } = await supabase.rpc('find_duplicate_events');

  if (error) {
    // Fallback: fetch all events and group client-side
    const { data: events } = await supabase
      .from('events')
      .select('id, name, date, organization')
      .order('date', { ascending: false });

    if (!events) return NextResponse.json({ error: 'fetch failed' }, { status: 500 });

    const groups: Record<string, typeof events> = {};
    for (const ev of events) {
      const key = `${ev.date}__${ev.name.toLowerCase().trim()}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(ev);
    }

    const duplicates = Object.values(groups).filter((g) => g.length > 1);
    return NextResponse.json({ duplicates, total: duplicates.length });
  }

  return NextResponse.json({ duplicates: data });
}
