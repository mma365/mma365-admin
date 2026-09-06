import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { buildFactDossier, type ArticleSubject } from '@/lib/articles/factDossier';
import { generateArticle } from '@/lib/articles/generate';

export const maxDuration = 300; // la génération peut prendre plusieurs minutes

export async function POST(request: Request) {
  try {
    const { type, eventId, fightId, fighterId, angle } = await request.json();

    if (!['preview', 'focus', 'portrait'].includes(type)) {
      return NextResponse.json({ error: 'type invalide (preview, focus ou portrait)' }, { status: 400 });
    }

    const subject: ArticleSubject = { type, eventId, fightId, fighterId };
    const dossier = await buildFactDossier(subject);
    const article = await generateArticle(subject, dossier, angle || undefined);

    const supabase = createAdminClient();

    // Slug unique : suffixe date si collision
    let slug = article.slug;
    const { data: existing } = await supabase.from('articles').select('id').eq('slug', slug).maybeSingle();
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const { data, error } = await supabase
      .from('articles')
      .insert({
        type,
        status: 'draft',
        source: 'manual',
        event_id: eventId ?? null,
        fight_id: fightId ?? null,
        fighter_id: fighterId ?? null,
        title_fr: article.title_fr,
        title_en: article.title_en,
        excerpt_fr: article.excerpt_fr,
        excerpt_en: article.excerpt_en,
        body_fr: article.body_fr,
        body_en: article.body_en,
        insta_caption_fr: article.insta_caption_fr,
        insta_caption_en: article.insta_caption_en,
        slug,
        angle: article.angle,
        fact_dossier: dossier,
      })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
