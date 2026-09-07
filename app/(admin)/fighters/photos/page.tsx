import { createAdminClient } from '@/lib/supabase/server';
import PhotoReviewQueue, { type CandidateFighter } from './PhotoReviewQueue';

export const dynamic = 'force-dynamic';

export default async function FighterPhotosPage() {
  const supabase = createAdminClient();

  // Photos the pipeline finds now go straight to fighters.image_uri, no
  // review step (Rachid, 2026-09-08 — trusts the automated crop/quality
  // pipeline). This queue is only for photo_not_found: fighters an official
  // org site had nothing for, needing a photo sourced by hand.
  const { data } = await supabase
    .from('fighters')
    .select('id, first_name, last_name, organization')
    .eq('photo_not_found', true)
    .order('organization', { ascending: true })
    .limit(200);

  const rows = (data ?? []) as CandidateFighter[];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Photos à sourcer</h1>
        <p className="text-gray-500 text-sm mt-1">
          Combattants pour qui aucune photo n&apos;a été trouvée automatiquement (UFC, ONE, KSW, PFL). Trouvées, les photos sont mises en ligne directement, sans passer par ici.
          {' '}{rows.length} à traiter.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-10 text-center text-gray-500 text-sm">
          Rien à sourcer pour le moment.
        </div>
      ) : (
        <PhotoReviewQueue candidates={rows} />
      )}
    </div>
  );
}
