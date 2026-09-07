import { createAdminClient } from '@/lib/supabase/server';
import PhotoReviewQueue, { type CandidateFighter } from './PhotoReviewQueue';

export const dynamic = 'force-dynamic';

export default async function FighterPhotosPage() {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('fighters')
    .select('id, first_name, last_name, organization, image_uri_candidate, photo_not_found')
    .or('image_uri_candidate.not.is.null,photo_not_found.eq.true')
    .order('organization', { ascending: true })
    .limit(200);

  const rows = (data ?? []) as CandidateFighter[];
  const withCandidate = rows.filter((f) => f.image_uri_candidate);
  const notFound = rows.filter((f) => !f.image_uri_candidate);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Photos à valider</h1>
        <p className="text-gray-500 text-sm mt-1">
          Photos trouvées sur les sites officiels (UFC, ONE, KSW, PFL), en attente de validation avant de devenir visibles dans l&apos;app.
          {' '}{withCandidate.length} en attente
          {notFound.length > 0 && <> · {notFound.length} sans photo trouvée, à sourcer manuellement</>}.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-10 text-center text-gray-500 text-sm">
          Rien à valider pour le moment.
        </div>
      ) : (
        <PhotoReviewQueue candidates={rows} />
      )}
    </div>
  );
}
