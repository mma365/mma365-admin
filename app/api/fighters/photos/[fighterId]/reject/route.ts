import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const BUCKET = 'fighter-photos';

export async function POST(_request: Request, { params }: { params: Promise<{ fighterId: string }> }) {
  const { fighterId } = await params;
  const supabase = createAdminClient();

  const { error: dbError } = await supabase
    .from('fighters')
    .update({ image_uri_candidate: null, photo_rejected: true, photo_not_found: false })
    .eq('id', fighterId);
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Best-effort cleanup — a rejected candidate shouldn't linger in Storage.
  await supabase.storage.from(BUCKET).remove([
    `pending/${fighterId}.jpg`,
    `pending/${fighterId}_source.jpg`,
    `pending/${fighterId}.json`,
  ]);

  return NextResponse.json({ ok: true });
}
