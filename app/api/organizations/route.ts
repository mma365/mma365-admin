import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('display_order');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

    const body = await request.json();
    const allowed = ['is_active', 'accent_dark', 'accent_light', 'short_name',
                     'tier', 'region', 'country', 'display_order', 'has_rankings'];
    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) patch[key] = body[key];
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Aucun champ valide fourni' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from('organizations').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
