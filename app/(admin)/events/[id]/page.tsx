import { createAdminClient } from '@/lib/supabase/server';
import EventEditForm from './EventEditForm';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function EventEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data: event }, { data: fights }] = await Promise.all([
    supabase.from('events').select('*').eq('id', id).single(),
    supabase
      .from('fights')
      .select('id,weight_class,is_main_event,is_title_fight,outcome,red_corner_fighter_id,blue_corner_fighter_id')
      .eq('event_id', id)
      .order('is_main_event', { ascending: false }),
  ]);

  if (!event) notFound();

  return <EventEditForm event={event} fights={fights ?? []} />;
}
