import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const type = searchParams.get('type');

  if (!q || q.length < 2) return NextResponse.json([]);

  const supabase = createAdminClient();

  if (type === 'event') {
    const { data } = await supabase
      .from('events')
      .select('id, name, date, organization')
      .ilike('name', `%${q}%`)
      .order('date', { ascending: false })
      .limit(8);

    return NextResponse.json(
      (data ?? []).map((e: { id: string; name: string; date: string; organization: string }) => ({
        id: e.id,
        label: e.name,
        sublabel: `${e.organization} · ${e.date}`,
      }))
    );
  }

  if (type === 'fighter') {
    const { data } = await supabase
      .from('fighters')
      .select('id, first_name, last_name, organization')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      .limit(8);

    return NextResponse.json(
      (data ?? []).map((f: { id: string; first_name: string; last_name: string; organization: string }) => ({
        id: f.id,
        label: `${f.first_name} ${f.last_name}`,
        sublabel: f.organization,
      }))
    );
  }

  return NextResponse.json([]);
}
