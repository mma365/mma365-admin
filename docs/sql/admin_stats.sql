-- Page Stats de l'admin (app/(admin)/stats/page.tsx) : UNE fonction qui renvoie tous les
-- chiffres en un seul JSON. Les comptes se font ici, pas dans Next : une requête directe
-- PostgREST est plafonnée à 1 000 lignes, des comptes faits côté admin seraient faux en silence.
--
-- Sources :
--  - push_tokens        → appareils inscrits aux notifications (≠ téléchargements : sans
--                         autorisation de notif pas de token, une réinstallation crée un
--                         nouveau token, les tokens morts ne sont pas supprimés) ;
--  - app_events         → vues de fiches, recherches, ouvertures de notifs (mma365/docs/sql/app_events.sql) ;
--  - notifications_log  → notifs serveur envoyées + recipients_count (appareils remis).
--
-- Paramètres : p_days (1 à 365, jours calendaires heure de Paris, aujourd'hui compris),
-- p_lang ('all' | 'fr' | 'en' — même règle que notify.py : fr = locale qui commence par
-- « fr », tout le reste, y compris inconnu, = en), p_include_internal (lignes du tampon interne).
-- notifications_log n'a pas de langue : les envois sont toujours toutes langues confondues.
--
-- Accès : clé service uniquement (l'admin). L'app ne peut pas l'appeler.
-- À coller dans le SQL Editor, en une seule exécution. Rejouable sans risque.

create or replace function public.admin_stats(
  p_days integer default 30,
  p_lang text default 'all',
  p_include_internal boolean default false
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tz    constant text := 'Europe/Paris';
  v_days  integer := greatest(1, least(coalesce(p_days, 30), 365));
  v_lang  text := case when p_lang in ('fr', 'en') then p_lang else 'all' end;
  v_today date := (now() at time zone v_tz)::date;
  v_first date;
  v_since timestamptz;
  result  jsonb;
begin
  v_first := v_today - (v_days - 1);
  v_since := v_first::timestamp at time zone v_tz;   -- minuit (Paris) du premier jour

  with
  ev as (
    select e.name, e.entity_id, e.source, e.query, e.notif_type, e.created_at
    from public.app_events e
    where e.created_at >= v_since
      and (p_include_internal or not e.internal)
      and (v_lang = 'all' or (v_lang = 'fr') = (coalesce(e.locale, '') ilike 'fr%'))
  ),
  tok as (
    select t.platform, t.created_at, t.last_seen
    from public.push_tokens t
    where v_lang = 'all' or (v_lang = 'fr') = (coalesce(t.locale, '') ilike 'fr%')
  ),
  days as (
    select generate_series(v_first, v_today, interval '1 day')::date as d
  )
  select jsonb_build_object(
    'days',  v_days,
    'lang',  v_lang,
    'first', v_first,

    'devices', jsonb_build_object(
      'total',   (select count(*) from tok),
      'new',     (select count(*) from tok where created_at >= v_since),
      'active7', (select count(*) from tok where last_seen >= now() - interval '7 days'),
      'ios',     (select count(*) from tok where platform = 'ios'),
      'android', (select count(*) from tok where platform = 'android'),
      'by_day',  (select coalesce(jsonb_agg(jsonb_build_object('day', d.d, 'n', coalesce(c.n, 0)) order by d.d), '[]'::jsonb)
                  from days d
                  left join (select (created_at at time zone v_tz)::date as d, count(*) as n
                             from tok where created_at >= v_since group by 1) c on c.d = d.d)
    ),

    'usage', jsonb_build_object(
      'views',       (select count(*) from ev where name like 'view\_%'),
      'searches',    (select count(*) from ev where name in ('search_select', 'search_empty')),
      'notif_opens', (select count(*) from ev where name = 'notif_open'),
      'by_day',      (select coalesce(jsonb_agg(jsonb_build_object('day', d.d, 'n', coalesce(c.n, 0)) order by d.d), '[]'::jsonb)
                      from days d
                      left join (select (created_at at time zone v_tz)::date as d, count(*) as n
                                 from ev where name like 'view\_%' group by 1) c on c.d = d.d)
    ),

    'top_fighters', (select coalesce(jsonb_agg(x order by x.n desc, x.label), '[]'::jsonb) from (
      select ev.entity_id as id,
             coalesce(f.first_name || ' ' || f.last_name, ev.entity_id) as label,
             f.organization as detail,
             count(*) as n
      from ev left join public.fighters f on f.id = ev.entity_id
      where ev.name = 'view_fighter'
      group by 1, 2, 3 order by n desc, label limit 10) x),

    'top_events', (select coalesce(jsonb_agg(x order by x.n desc, x.label), '[]'::jsonb) from (
      select ev.entity_id as id,
             coalesce(e.name, ev.entity_id) as label,
             e.organization || ' · ' || to_char(e.date, 'DD/MM/YYYY') as detail,
             count(*) as n
      from ev left join public.events e on e.id = ev.entity_id
      where ev.name = 'view_event'
      group by 1, 2, 3 order by n desc, label limit 10) x),

    'top_fights', (select coalesce(jsonb_agg(x order by x.n desc, x.label), '[]'::jsonb) from (
      select ev.entity_id as id,
             coalesce(r.last_name || ' vs ' || b.last_name, ev.entity_id) as label,
             e.name as detail,
             count(*) as n
      from ev
      left join public.fights fi on fi.id = ev.entity_id
      left join public.fighters r on r.id = fi.red_corner_fighter_id
      left join public.fighters b on b.id = fi.blue_corner_fighter_id
      left join public.events e on e.id = fi.event_id
      where ev.name = 'view_fight'
      group by 1, 2, 3 order by n desc, label limit 10) x),

    'top_articles', (select coalesce(jsonb_agg(x order by x.n desc, x.label), '[]'::jsonb) from (
      select ev.entity_id as id,
             coalesce(nullif(a.title_fr, ''), nullif(a.title_en, ''), ev.entity_id) as label,
             a.type as detail,
             count(*) as n
      from ev left join public.articles a on a.slug = ev.entity_id
      where ev.name = 'view_article'
      group by 1, 2, 3 order by n desc, label limit 10) x),

    'sources', (select coalesce(jsonb_agg(x order by x.n desc), '[]'::jsonb) from (
      select coalesce(source, 'other') as label, count(*) as n
      from ev where name like 'view\_%'
      group by 1) x),

    'searches', jsonb_build_object(
      'selects', (select count(*) from ev where name = 'search_select'),
      'empties', (select count(*) from ev where name = 'search_empty'),
      'top_queries', (select coalesce(jsonb_agg(x order by x.n desc, x.label), '[]'::jsonb) from (
        select query as label, count(*) as n from ev
        where name = 'search_select' and query is not null
        group by 1 order by n desc, label limit 15) x),
      'top_empty', (select coalesce(jsonb_agg(x order by x.n desc, x.label), '[]'::jsonb) from (
        select query as label, count(*) as n from ev
        where name = 'search_empty' and query is not null
        group by 1 order by n desc, label limit 15) x)
    ),

    'notifs', (select coalesce(jsonb_agg(x order by x.envois desc, x.ouvertures desc, x.type), '[]'::jsonb) from (
      select coalesce(s.type, o.type) as type,
             coalesce(s.envois, 0) as envois,
             s.remis,                              -- null : envois d'avant recipients_count
             coalesce(o.n, 0) as ouvertures
      from (select type, count(*) as envois, sum(recipients_count) as remis
            from public.notifications_log where sent_at >= v_since group by 1) s
      full join (select notif_type as type, count(*) as n
                 from ev where name = 'notif_open' group by 1) o on o.type = s.type) x)
  )
  into result;

  return result;
end $$;

revoke execute on function public.admin_stats(integer, text, boolean) from public, anon, authenticated;
grant execute on function public.admin_stats(integer, text, boolean) to service_role;

-- ── Test (lecture seule) ────────────────────────────────────────────────────────
-- select public.admin_stats(30, 'all', false);

-- ── Annulation ──────────────────────────────────────────────────────────────────
-- drop function public.admin_stats(integer, text, boolean);
