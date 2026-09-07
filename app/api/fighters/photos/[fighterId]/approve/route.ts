import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import sharp from 'sharp';

const BUCKET = 'fighter-photos';
const OUTPUT_SIZE = 300;

type Crop = { x: number; y: number; width: number; height: number };

function clampCrop(crop: Crop, imgWidth: number, imgHeight: number): Crop {
  const x = Math.max(0, Math.min(Math.round(crop.x), imgWidth - 1));
  const y = Math.max(0, Math.min(Math.round(crop.y), imgHeight - 1));
  const width = Math.max(1, Math.min(Math.round(crop.width), imgWidth - x));
  const height = Math.max(1, Math.min(Math.round(crop.height), imgHeight - y));
  return { x, y, width, height };
}

async function cropAndResize(sourceBuffer: Buffer, crop: Crop): Promise<Buffer> {
  const meta = await sharp(sourceBuffer).metadata();
  const clamped = clampCrop(crop, meta.width ?? crop.x + crop.width, meta.height ?? crop.y + crop.height);
  return sharp(sourceBuffer)
    .extract({ left: clamped.x, top: clamped.y, width: clamped.width, height: clamped.height })
    .resize(OUTPUT_SIZE, OUTPUT_SIZE)
    .jpeg({ quality: 85 })
    .toBuffer();
}

export async function POST(request: Request, { params }: { params: Promise<{ fighterId: string }> }) {
  const { fighterId } = await params;
  const supabase = createAdminClient();
  const contentType = request.headers.get('content-type') ?? '';

  let source: 'candidate' | 'manual';
  let crop: Crop;
  let sourceBuffer: Buffer;

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      source = (form.get('source') as string) === 'manual' ? 'manual' : 'candidate';
      crop = JSON.parse(form.get('crop') as string);
      const file = form.get('file') as File | null;
      if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
      sourceBuffer = Buffer.from(await file.arrayBuffer());
    } else {
      const body = await request.json();
      source = body.source === 'manual' ? 'manual' : 'candidate';
      crop = body.crop;

      if (source === 'manual') {
        if (!body.imageUrl) return NextResponse.json({ error: 'URL manquante' }, { status: 400 });
        const res = await fetch(body.imageUrl);
        if (!res.ok) return NextResponse.json({ error: `Impossible de télécharger l'image (${res.status})` }, { status: 400 });
        sourceBuffer = Buffer.from(await res.arrayBuffer());
      } else {
        const { data, error } = await supabase.storage.from(BUCKET).download(`pending/${fighterId}_source.jpg`);
        if (error || !data) return NextResponse.json({ error: 'Photo en attente introuvable' }, { status: 404 });
        sourceBuffer = Buffer.from(await data.arrayBuffer());
      }
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }

  let finalJpeg: Buffer;
  try {
    finalJpeg = await cropAndResize(sourceBuffer, crop);
  } catch (e) {
    return NextResponse.json({ error: `Recadrage échoué: ${e instanceof Error ? e.message : String(e)}` }, { status: 400 });
  }

  const livePath = `${fighterId}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(livePath, finalJpeg, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(livePath);
  // Cache-bust: an approved fighter may be re-approved later (photo swapped
  // via "Remplacer" after already being live) — without a query param the
  // CDN/browser cache would keep serving the old bytes at the same URL.
  const imageUri = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error: dbError } = await supabase
    .from('fighters')
    .update({ image_uri: imageUri, image_uri_candidate: null, photo_rejected: false, photo_not_found: false })
    .eq('id', fighterId);
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Clean up staged objects — best-effort, don't fail the request over it.
  await supabase.storage.from(BUCKET).remove([
    `pending/${fighterId}.jpg`,
    `pending/${fighterId}_source.jpg`,
    `pending/${fighterId}.json`,
  ]);

  const now = new Date().toISOString();
  await supabase.from('app_meta').upsert({ key: 'fighters_version', value: now, updated_at: now }, { onConflict: 'key' });

  return NextResponse.json({ ok: true, image_uri: imageUri });
}
