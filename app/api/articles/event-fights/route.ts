import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

/** Combats d'un event, pour le sélecteur de sujet du format « Focus combat ». */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  if (!eventId) return NextResponse.json([]);

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('fights')
    .select(`id, weight_class, is_main_event, is_co_main_event, is_prelim,
      red:fighters!red_corner_fighter_id(first_name, last_name),
      blue:fighters!blue_corner_fighter_id(first_name, last_name)`)
    .eq('event_id', eventId);

  type Row = {
    id: string; weight_class: string | null; is_main_event: boolean; is_co_main_event: boolean; is_prelim: boolean;
    red: { first_name: string; last_name: string } | null;
    blue: { first_name: string; last_name: string } | null;
  };

  const fights = ((data ?? []) as Row[])
    .sort((a, b) => {
      const rank = (f: Row) => (f.is_main_event ? 0 : f.is_co_main_event ? 1 : f.is_prelim ? 3 : 2);
      return rank(a) - rank(b);
    })
    .map((f) => ({
      id: f.id,
      label: `${f.red ? `${f.red.first_name} ${f.red.last_name}` : '?'} vs ${f.blue ? `${f.blue.first_name} ${f.blue.last_name}` : '?'}`,
      sublabel: [
        f.is_main_event ? 'Main event' : f.is_co_main_event ? 'Co-main' : f.is_prelim ? 'Prelim' : 'Main card',
        f.weight_class,
      ].filter(Boolean).join(' · '),
    }));

  return NextResponse.json(fights);
}
