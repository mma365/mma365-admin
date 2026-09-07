import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const BUCKET = 'fighter-photos';

// Approves one or many pending candidates AS-IS — promotes the already-
// computed suggested crop (pending/{id}.jpg, already the final white-
// background square JPEG) straight to the live path. No re-cropping: this
// is the "accept the suggestion" path, for the quick single-click Valider
// button and for multi-select bulk approve. Ajuster & valider (a custom
// crop) still goes through the per-fighter approve route instead.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const fighterIds: unknown = body?.fighterIds;
  if (!Array.isArray(fighterIds) || fighterIds.length === 0 || !fighterIds.every((id) => typeof id === 'string')) {
    return NextResponse.json({ error: 'fighterIds manquant ou invalide' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const fighterId of fighterIds as string[]) {
    try {
      const { data, error } = await supabase.storage.from(BUCKET).download(`pending/${fighterId}.jpg`);
      if (error || !data) {
        results.push({ id: fighterId, ok: false, error: 'Photo en attente introuvable' });
        continue;
      }
      const buffer = Buffer.from(await data.arrayBuffer());

      const livePath = `${fighterId}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(livePath, buffer, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) {
        results.push({ id: fighterId, ok: false, error: uploadError.message });
        continue;
      }

      const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(livePath);
      const imageUri = `${publicUrlData.publicUrl}?v=${Date.now()}`;

      const { error: dbError } = await supabase
        .from('fighters')
        .update({ image_uri: imageUri, image_uri_candidate: null, photo_rejected: false })
        .eq('id', fighterId);
      if (dbError) {
        results.push({ id: fighterId, ok: false, error: dbError.message });
        continue;
      }

      await supabase.storage.from(BUCKET).remove([
        `pending/${fighterId}.jpg`,
        `pending/${fighterId}_source.jpg`,
        `pending/${fighterId}.json`,
      ]);

      results.push({ id: fighterId, ok: true });
    } catch (e) {
      results.push({ id: fighterId, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  if (results.some((r) => r.ok)) {
    const now = new Date().toISOString();
    await supabase.from('app_meta').upsert({ key: 'fighters_version', value: now, updated_at: now }, { onConflict: 'key' });
  }

  return NextResponse.json({ results });
}
