import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

/** Création d'un article vide (rédaction manuelle dans l'éditeur). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const type = ['preview', 'focus', 'portrait', 'libre'].includes(body.type) ? body.type : 'libre';

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('articles')
    .insert({
      type,
      status: 'draft',
      source: 'manual',
      event_id: body.eventId ?? null,
      fight_id: body.fightId ?? null,
      fighter_id: body.fighterId ?? null,
      slug: `brouillon-${Date.now().toString(36)}`,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
