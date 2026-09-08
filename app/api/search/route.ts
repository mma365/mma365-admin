import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const type = searchParams.get('type');

  const supabase = createAdminClient();

  // Articles : liste courte, on autorise une requête vide (→ derniers publiés)
  // pour que l'admin puisse choisir sans forcément taper le titre.
  if (type === 'article') {
    let query = supabase
      .from('articles')
      .select('slug, title_fr, type')
      .eq('status', 'published')
      .not('slug', 'is', null)
      .order('published_web_at', { ascending: false })
      .limit(8);
    if (q.length >= 2) query = query.ilike('title_fr', `%${q}%`);

    const { data } = await query;
    return NextResponse.json(
      (data ?? []).map((a: { slug: string; title_fr: string; type: string }) => ({
        id: a.slug,
        label: a.title_fr,
        sublabel: a.type,
      }))
    );
  }

  if (!q || q.length < 2) return NextResponse.json([]);

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
