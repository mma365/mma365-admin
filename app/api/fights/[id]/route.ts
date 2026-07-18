import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const supabase = createAdminClient();
  const { error } = await supabase.from('fights').update(body).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const now = new Date().toISOString();
  await supabase.from('app_meta').upsert({ key: 'events_version', value: now, updated_at: now }, { onConflict: 'key' });
  return NextResponse.json({ ok: true });
}
