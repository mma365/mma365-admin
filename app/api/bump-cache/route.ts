import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { bumpEvents } from '@/lib/appMeta';

export async function POST() {
  const supabase = createAdminClient();
  const ts = new Date().toISOString();

  // events_version : bump forcé via le journal (entrée 'all' → l'app 1.5 recharge tout).
  await bumpEvents(supabase, true);

  const keys = ['fighters_version', 'rankings_version', 'articles_version', 'press_version'];
  for (const key of keys) {
    await supabase.from('app_meta').upsert({ key, value: ts, updated_at: ts }, { onConflict: 'key' });
  }

  return NextResponse.json({ ok: true, ts });
}
