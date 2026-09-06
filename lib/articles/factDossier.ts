import { createAdminClient } from '@/lib/supabase/server';

/**
 * Construit le "dossier de faits fermé" d'un article : tout ce que le
 * générateur a le droit d'utiliser, extrait de la DB. Rien d'autre.
 * Le dossier est stocké avec l'article (fact_dossier) pour la relecture.
 */

export type ArticleSubject = {
  type: 'preview' | 'focus' | 'portrait' | 'libre';
  eventId?: string;
  fightId?: string;
  fighterId?: string;
};

const FIGHTER_COLS = 'id, first_name, last_name, nickname, country, wins, losses, draws, organization, weight_class, date_of_birth, popularity';

type FighterRow = {
  id: string; first_name: string; last_name: string; nickname: string | null;
  country: string | null; wins: number; losses: number; draws: number;
  organization: string; weight_class: string | null; date_of_birth: string | null;
  popularity: number | null;
};

function fighterSummary(f: FighterRow) {
  return {
    id: f.id,
    name: `${f.first_name} ${f.last_name}`,
    nickname: f.nickname,
    country: f.country,
    record: `${f.wins}-${f.losses}${f.draws ? `-${f.draws}` : ''}`,
    organization: f.organization,
    weightClass: f.weight_class,
    dateOfBirth: f.date_of_birth,
  };
}

/** Historique complet d'un fighter, avec noms d'adversaires et events, trié par date. */
async function fighterHistory(supabase: ReturnType<typeof createAdminClient>, fighterId: string) {
  const { data } = await supabase
    .from('fights')
    .select(`red_corner_fighter_id, blue_corner_fighter_id, winner_id, method, round, time, weight_class, is_title_fight,
      red:fighters!red_corner_fighter_id(id, first_name, last_name),
      blue:fighters!blue_corner_fighter_id(id, first_name, last_name),
      event:events(name, date, organization)`)
    .or(`red_corner_fighter_id.eq.${fighterId},blue_corner_fighter_id.eq.${fighterId}`)
    .not('winner_id', 'is', null);

  type Row = {
    red_corner_fighter_id: string; blue_corner_fighter_id: string;
    winner_id: string; method: string | null; round: number | null; time: string | null;
    weight_class: string | null; is_title_fight: boolean;
    red: { id: string; first_name: string; last_name: string } | null;
    blue: { id: string; first_name: string; last_name: string } | null;
    event: { name: string; date: string; organization: string } | null;
  };

  return ((data ?? []) as Row[])
    .filter((r) => r.event)
    .sort((a, b) => (a.event!.date < b.event!.date ? -1 : 1))
    .map((r) => {
      const opponent = r.red_corner_fighter_id === fighterId ? r.blue : r.red;
      return {
        date: r.event!.date,
        event: r.event!.name,
        organization: r.event!.organization,
        opponent: opponent ? `${opponent.first_name} ${opponent.last_name}` : 'inconnu',
        opponentId: opponent?.id ?? null,
        result: r.winner_id === fighterId ? 'victoire' : 'défaite',
        method: r.method,
        round: r.round,
        time: r.time,
        weightClass: r.weight_class,
        titleFight: r.is_title_fight,
      };
    });
}

/** Entrées de ranking pour un ensemble de fighters. */
async function rankingsFor(supabase: ReturnType<typeof createAdminClient>, fighterIds: string[]) {
  if (fighterIds.length === 0) return [];
  const { data } = await supabase
    .from('ranking_entries')
    .select('fighter_id, rank, trend, is_new, board:ranking_boards(organization, weight_class, champion_id)')
    .in('fighter_id', fighterIds);

  type Row = {
    fighter_id: string; rank: number; trend: string | null; is_new: boolean;
    board: { organization: string; weight_class: string; champion_id: string | null } | null;
  };

  return ((data ?? []) as Row[]).map((r) => ({
    fighterId: r.fighter_id,
    rank: r.rank,
    trend: r.trend,
    isNew: r.is_new,
    organization: r.board?.organization,
    weightClass: r.board?.weight_class,
    isChampion: r.board?.champion_id === r.fighter_id,
  }));
}

async function eventCard(supabase: ReturnType<typeof createAdminClient>, eventId: string) {
  const { data } = await supabase
    .from('fights')
    .select(`id, weight_class, is_main_event, is_co_main_event, is_prelim, is_title_fight, scheduled_rounds,
      red:fighters!red_corner_fighter_id(${FIGHTER_COLS}),
      blue:fighters!blue_corner_fighter_id(${FIGHTER_COLS})`)
    .eq('event_id', eventId)
    .is('winner_id', null);

  type Row = {
    id: string; weight_class: string | null; is_main_event: boolean; is_co_main_event: boolean;
    is_prelim: boolean; is_title_fight: boolean; scheduled_rounds: number | null;
    red: FighterRow | null; blue: FighterRow | null;
  };

  return ((data ?? []) as Row[])
    .sort((a, b) => {
      const rank = (f: Row) => (f.is_main_event ? 0 : f.is_co_main_event ? 1 : f.is_prelim ? 3 : 2);
      return rank(a) - rank(b);
    })
    .map((f) => ({
      fightId: f.id,
      weightClass: f.weight_class,
      mainEvent: f.is_main_event,
      coMainEvent: f.is_co_main_event,
      prelim: f.is_prelim,
      titleFight: f.is_title_fight,
      scheduledRounds: f.scheduled_rounds,
      red: f.red ? fighterSummary(f.red) : null,
      blue: f.blue ? fighterSummary(f.blue) : null,
    }));
}

async function getEvent(supabase: ReturnType<typeof createAdminClient>, eventId: string) {
  const { data } = await supabase
    .from('events')
    .select('id, name, date, organization, venue, city, country, main_card_time_utc, broadcasters')
    .eq('id', eventId)
    .single();
  return data;
}

async function getFighter(supabase: ReturnType<typeof createAdminClient>, fighterId: string) {
  const { data } = await supabase.from('fighters').select(FIGHTER_COLS).eq('id', fighterId).single();
  return data as FighterRow | null;
}

/**
 * Construit le dossier selon le type d'article.
 * - preview  : event + carte complète + historiques des fighters main/co-main + rankings
 * - focus    : combat + event + les deux fighters + historiques complets + rankings
 * - portrait : fighter + historique complet + prochain combat + ranking
 */
export async function buildFactDossier(subject: ArticleSubject): Promise<Record<string, unknown>> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split('T')[0];

  if (subject.type === 'preview' && subject.eventId) {
    const [event, card] = await Promise.all([
      getEvent(supabase, subject.eventId),
      eventCard(supabase, subject.eventId),
    ]);
    if (!event) throw new Error('Event introuvable');

    // Historiques des fighters du main + co-main uniquement (le dossier reste digeste)
    const keyFighterIds = card
      .filter((f) => f.mainEvent || f.coMainEvent)
      .flatMap((f) => [f.red?.id, f.blue?.id])
      .filter((id): id is string => Boolean(id));

    const histories: Record<string, unknown> = {};
    for (const id of keyFighterIds) {
      histories[id] = await fighterHistory(supabase, id);
    }
    const rankings = await rankingsFor(supabase, card.flatMap((f) => [f.red?.id, f.blue?.id]).filter((id): id is string => Boolean(id)));

    return { articleType: 'preview', today, event, card, histories, rankings };
  }

  if (subject.type === 'focus' && subject.fightId) {
    const { data: fight } = await supabase
      .from('fights')
      .select(`id, event_id, weight_class, is_main_event, is_co_main_event, is_title_fight, scheduled_rounds,
        red:fighters!red_corner_fighter_id(${FIGHTER_COLS}),
        blue:fighters!blue_corner_fighter_id(${FIGHTER_COLS})`)
      .eq('id', subject.fightId)
      .single();
    if (!fight) throw new Error('Combat introuvable');

    type FightRow = {
      id: string; event_id: string; weight_class: string | null; is_main_event: boolean;
      is_co_main_event: boolean; is_title_fight: boolean; scheduled_rounds: number | null;
      red: FighterRow | null; blue: FighterRow | null;
    };
    const f = fight as FightRow;

    const event = await getEvent(supabase, f.event_id);
    const ids = [f.red?.id, f.blue?.id].filter((id): id is string => Boolean(id));
    const histories: Record<string, unknown> = {};
    for (const id of ids) histories[id] = await fighterHistory(supabase, id);
    const rankings = await rankingsFor(supabase, ids);

    return {
      articleType: 'focus',
      today,
      event,
      fight: {
        weightClass: f.weight_class,
        mainEvent: f.is_main_event,
        coMainEvent: f.is_co_main_event,
        titleFight: f.is_title_fight,
        scheduledRounds: f.scheduled_rounds,
        red: f.red ? fighterSummary(f.red) : null,
        blue: f.blue ? fighterSummary(f.blue) : null,
      },
      histories,
      rankings,
    };
  }

  if (subject.type === 'portrait' && subject.fighterId) {
    const fighter = await getFighter(supabase, subject.fighterId);
    if (!fighter) throw new Error('Fighter introuvable');

    const history = await fighterHistory(supabase, subject.fighterId);
    const rankings = await rankingsFor(supabase, [subject.fighterId]);

    // Prochain combat programmé (event à venir, sans vainqueur)
    const { data: upcoming } = await supabase
      .from('fights')
      .select(`weight_class, is_main_event, is_title_fight,
        red:fighters!red_corner_fighter_id(${FIGHTER_COLS}),
        blue:fighters!blue_corner_fighter_id(${FIGHTER_COLS}),
        event:events!inner(name, date, organization, venue, city)`)
      .or(`red_corner_fighter_id.eq.${subject.fighterId},blue_corner_fighter_id.eq.${subject.fighterId}`)
      .is('winner_id', null)
      .gte('event.date', today);

    type UpRow = {
      weight_class: string | null; is_main_event: boolean; is_title_fight: boolean;
      red: FighterRow | null; blue: FighterRow | null;
      event: { name: string; date: string; organization: string; venue: string | null; city: string | null };
    };
    const next = ((upcoming ?? []) as UpRow[]).sort((a, b) => (a.event.date < b.event.date ? -1 : 1))[0] ?? null;

    return {
      articleType: 'portrait',
      today,
      fighter: fighterSummary(fighter),
      history,
      rankings,
      nextFight: next
        ? {
            event: next.event,
            weightClass: next.weight_class,
            mainEvent: next.is_main_event,
            titleFight: next.is_title_fight,
            opponent:
              next.red?.id === subject.fighterId
                ? next.blue ? fighterSummary(next.blue) : null
                : next.red ? fighterSummary(next.red) : null,
          }
        : null,
    };
  }

  throw new Error('Sujet invalide : il faut un event (preview), un combat (focus) ou un fighter (portrait).');
}
