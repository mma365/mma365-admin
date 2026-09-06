import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = createAdminClient();
  const ts = new Date().toISOString();

  const keys = ['events_version', 'fighters_version', 'rankings_version', 'articles_version', 'press_version'];
  for (const key of keys) {
    await supabase.from('app_meta').upsert({ key, value: ts, updated_at: ts }, { onConflict: 'key' });
  }

  return NextResponse.json({ ok: true, ts });
}
