import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const EDITABLE_FIELDS = [
  'title_fr', 'title_en', 'excerpt_fr', 'excerpt_en', 'body_fr', 'body_en',
  'insta_caption_fr', 'insta_caption_en', 'slug', 'angle', 'status',
  'published_web_at', 'insta_posted_at',
] as const;

/** Invalide le cache "articles" de l'app (écran Actus) après une écriture. */
async function bumpArticlesVersion(supabase: ReturnType<typeof createAdminClient>) {
  const ts = new Date().toISOString();
  await supabase.from('app_meta').upsert({ key: 'articles_version', value: ts, updated_at: ts }, { onConflict: 'key' });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of EDITABLE_FIELDS) {
    if (field in body) updates[field] = body[field];
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('articles').update(updates).eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await bumpArticlesVersion(supabase);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from('articles').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await bumpArticlesVersion(supabase);
  return NextResponse.json({ ok: true });
}
