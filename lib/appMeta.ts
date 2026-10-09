import type { createAdminClient } from '@/lib/supabase/server';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Rafraîchit les tuiles d'events et publie le journal des changements
 * (mma-scrapers/sql/event_cards.sql). events_version n'augmente que si un event,
 * un combat ou une tuile a vraiment changé. force = true : bump même sans
 * changement, l'app recharge tout (bouton « Invalider le cache app »).
 * Retourne le nombre de changements publiés, ou null si la fonction n'existe
 * pas encore / a échoué.
 */
export async function publishEventChanges(supabase: AdminClient, force = false): Promise<number | null> {
  const { data, error } = await supabase.rpc('publish_event_changes', { force });
  if (error) {
    console.warn('[app_meta] publish_event_changes ignoré :', error.message);
    return null;
  }
  return Number(data ?? 0);
}

/** Après une écriture sur events / fights. Repli sur l'ancien bump direct si la fonction manque. */
export async function bumpEvents(supabase: AdminClient, force = false): Promise<void> {
  if ((await publishEventChanges(supabase, force)) !== null) return;
  const now = new Date().toISOString();
  await supabase.from('app_meta').upsert({ key: 'events_version', value: now, updated_at: now }, { onConflict: 'key' });
}

/** Après une écriture sur fighters : fighters_version, plus les tuiles (photo, palmarès d'une tête d'affiche). */
export async function bumpFighters(supabase: AdminClient): Promise<void> {
  const now = new Date().toISOString();
  await supabase.from('app_meta').upsert({ key: 'fighters_version', value: now, updated_at: now }, { onConflict: 'key' });
  await publishEventChanges(supabase);
}
