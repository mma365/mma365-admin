import { createAdminClient } from '@/lib/supabase/server';
import FighterEditForm from './FighterEditForm';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function FighterEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: fighter } = await supabase.from('fighters').select('*').eq('id', id).single();
  if (!fighter) notFound();
  return <FighterEditForm fighter={fighter} />;
}
