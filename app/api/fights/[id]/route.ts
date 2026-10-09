import { createAdminClient } from '@/lib/supabase/server';
import { bumpEvents } from '@/lib/appMeta';
import { NextResponse } from 'next/server';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const supabase = createAdminClient();
  const { error } = await supabase.from('fights').update(body).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await bumpEvents(supabase);
  return NextResponse.json({ ok: true });
}
