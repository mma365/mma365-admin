import { createAdminClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import ArticleEditForm from './ArticleEditForm';

export const dynamic = 'force-dynamic';

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: article } = await supabase.from('articles').select('*').eq('id', id).single();
  if (!article) notFound();

  return <ArticleEditForm article={article} />;
}
