-- Sync calendrier robuste aux changements de calendrier (#253).
--
-- Avant : un GP était identifié par (season, round). Quand Jolpica a inséré le
-- GP de Bahreïn délocalisé en Malaisie en manche 16 (31/07/2026), toutes les
-- manches suivantes ont glissé : la ligne de Singapour a été renommée en
-- Malaisie en gardant ses sessions sprint (mode sprint affiché à tort), et les
-- pronos déjà saisis sont passés au GP voisin.
--
-- Après : identité = circuit (circuitId Jolpica), le round n'est qu'un attribut
-- mis à jour. Rapprochement calculé côté TS (lib/f1/calendar-reconciliation.ts,
-- testé), appliqué ici en une transaction.

alter table public.grands_prix
  add column if not exists circuit_ref text;

comment on column public.grands_prix.circuit_ref is
  'circuitId Jolpica (ex. "sepang") — identité stable du GP pour la sync calendrier. Null pour une ligne pas encore resynchronisée (rapprochée par nom de circuit).';

-- Un GP annulé garde son ancien numéro de manche, que le calendrier réattribue
-- en général au GP suivant : l'unicité ne porte que sur les GPs actifs.
alter table public.grands_prix
  drop constraint if exists grands_prix_season_round_key;

create unique index if not exists grands_prix_active_season_round_key
  on public.grands_prix (season, round)
  where not is_cancelled;

-- ── apply_calendar_sync ───────────────────────────────────────────────────
-- p_matched  : [{ id, round, name, circuit, circuit_ref, country, is_sprint_weekend, weekend_starts_at }]
-- p_inserted : [{ round, name, circuit, circuit_ref, country, is_sprint_weekend, weekend_starts_at }]
-- p_cancelled: ids des GPs disparus du calendrier (jamais un GP déjà couru — filtré côté TS)
-- Retourne les GPs actifs de la saison (id, round) pour la sync des sessions.
create or replace function public.apply_calendar_sync(
  p_season    integer,
  p_matched   jsonb,
  p_inserted  jsonb,
  p_cancelled uuid[]
)
returns table (gp_id uuid, gp_round integer)
language plpgsql
set search_path = ''
as $$
begin
  -- 1. Annulations d'abord : elles sortent de l'index d'unicité partiel et
  --    libèrent leur numéro de manche.
  update public.grands_prix gp
  set is_cancelled = true
  where gp.id = any(p_cancelled)
    and gp.season = p_season;

  -- 2. Numéros temporaires hors plage : l'index unique est vérifié ligne à
  --    ligne, un réordonnancement direct (16→17 pendant que 17→18) collisionnerait.
  update public.grands_prix gp
  set round = gp.round + 100000
  from jsonb_to_recordset(p_matched) as m(id uuid)
  where gp.id = m.id
    and gp.season = p_season;

  -- 3. Valeurs finales (réactive un GP annulé qui revient au calendrier).
  update public.grands_prix gp
  set round             = m.round,
      name              = m.name,
      circuit           = m.circuit,
      circuit_ref       = m.circuit_ref,
      country           = m.country,
      is_sprint_weekend = m.is_sprint_weekend,
      weekend_starts_at = m.weekend_starts_at,
      is_cancelled      = false
  from jsonb_to_recordset(p_matched) as m(
    id                uuid,
    round             integer,
    name              text,
    circuit           text,
    circuit_ref       text,
    country           text,
    is_sprint_weekend boolean,
    weekend_starts_at timestamptz
  )
  where gp.id = m.id
    and gp.season = p_season;

  -- 4. Nouveaux GPs.
  insert into public.grands_prix
    (season, round, name, circuit, circuit_ref, country, is_sprint_weekend, weekend_starts_at)
  select p_season, e.round, e.name, e.circuit, e.circuit_ref, e.country, e.is_sprint_weekend, e.weekend_starts_at
  from jsonb_to_recordset(p_inserted) as e(
    round             integer,
    name              text,
    circuit           text,
    circuit_ref       text,
    country           text,
    is_sprint_weekend boolean,
    weekend_starts_at timestamptz
  );

  return query
    select gp.id, gp.round
    from public.grands_prix gp
    where gp.season = p_season
      and not gp.is_cancelled;
end;
$$;

-- ── prune_gp_sessions ─────────────────────────────────────────────────────
-- Supprime les sessions d'un GP absentes du calendrier (types hors
-- p_keep_types) et leurs pronos — sauf session déjà commencée ou aux résultats
-- confirmés (une session passée qui disparaît = trou de données Jolpica, pas
-- un changement de programme). N'est appelée que si le programme Jolpica du GP
-- est complet (isCalendarEntryScheduleComplete).
-- Tout ou rien : une session n'est jamais supprimée en laissant des pronos.
create or replace function public.prune_gp_sessions(
  p_gp_id      uuid,
  p_keep_types text[]
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_stale_ids uuid[];
begin
  select coalesce(array_agg(s.id), '{}')
  into v_stale_ids
  from public.sessions s
  where s.gp_id = p_gp_id
    and s.results_confirmed_at is null
    and s.starts_at > now()
    and not (s.type = any(p_keep_types));

  if cardinality(v_stale_ids) = 0 then
    return 0;
  end if;

  delete from public.predictions             where session_id = any(v_stale_ids);
  delete from public.fastest_lap_predictions where session_id = any(v_stale_ids);
  delete from public.scores                  where session_id = any(v_stale_ids);
  delete from public.session_results         where session_id = any(v_stale_ids);
  delete from public.sessions                where id         = any(v_stale_ids);

  return cardinality(v_stale_ids);
end;
$$;

-- Appelées uniquement par le cron de sync (service role) — même politique
-- que mark_items_resolved.
revoke all on function public.apply_calendar_sync(integer, jsonb, jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.apply_calendar_sync(integer, jsonb, jsonb, uuid[]) to service_role;
revoke all on function public.prune_gp_sessions(uuid, text[]) from public, anon, authenticated;
grant execute on function public.prune_gp_sessions(uuid, text[]) to service_role;
