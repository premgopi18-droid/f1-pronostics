-- Perf DB (#177) — trois chantiers remontés par les advisors Supabase :
--   1. RLS initplan : auth.uid() nu est ré-évalué PAR LIGNE dans une policy ;
--      l'entourer d'un sous-select `(select auth.uid())` le fait évaluer une
--      seule fois par requête (InitPlan). Aucun changement de sémantique.
--   2. Policies permissives multiples en SELECT : sur 5 tables, la policy
--      « own » (FOR ALL, qui inclut SELECT) coexistait avec une policy SELECT
--      « co-members » → Postgres évaluait les deux pour chaque ligne lue. On
--      scinde chaque « own » FOR ALL en INSERT/UPDATE/DELETE équivalents et on
--      fusionne le volet SELECT avec la condition co-members en OR. Les deux
--      expressions d'origine sont reprises À L'IDENTIQUE (seul l'initplan est
--      appliqué) : la visibilité des pronos avant/après lock ne change pas.
--   3. Index manquants sur foreign keys + drop d'un index doublon.
--
-- NB : les appels à auth.uid() INTERNES aux helpers is_member_of_league() /
-- shared_league() ne sont pas concernés (hors périmètre advisor).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1+2. predictions — own (ALL) + co-members after lock (SELECT)
-- ─────────────────────────────────────────────────────────────────────────────

drop policy "own predictions" on public.predictions;
drop policy "co-members after lock" on public.predictions;

create policy "own or co-members after lock" on public.predictions
  for select using (
    ((select auth.uid()) = user_id)
    or (
      ((select auth.uid()) <> user_id)
      and exists (
        select 1 from public.sessions
        where sessions.id = predictions.session_id
          and sessions.starts_at < now()
      )
      and public.shared_league(user_id)
    )
  );

create policy "own predictions insert" on public.predictions
  for insert with check ((select auth.uid()) = user_id);

create policy "own predictions update" on public.predictions
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own predictions delete" on public.predictions
  for delete using ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1+2. fastest_lap_predictions — own fl (ALL) + co-members fl after lock (SELECT)
-- ─────────────────────────────────────────────────────────────────────────────

drop policy "own fl predictions" on public.fastest_lap_predictions;
drop policy "co-members fl after lock" on public.fastest_lap_predictions;

create policy "own or co-members fl after lock" on public.fastest_lap_predictions
  for select using (
    ((select auth.uid()) = user_id)
    or (
      ((select auth.uid()) <> user_id)
      and exists (
        select 1 from public.sessions
        where sessions.id = fastest_lap_predictions.session_id
          and sessions.starts_at < now()
      )
      and public.shared_league(user_id)
    )
  );

create policy "own fl predictions insert" on public.fastest_lap_predictions
  for insert with check ((select auth.uid()) = user_id);

create policy "own fl predictions update" on public.fastest_lap_predictions
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own fl predictions delete" on public.fastest_lap_predictions
  for delete using ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1+2. season_predictions — own (ALL) + co-members after lock (SELECT)
-- ─────────────────────────────────────────────────────────────────────────────

drop policy "own season predictions" on public.season_predictions;
drop policy "co-members after lock" on public.season_predictions;

create policy "own or co-members after lock" on public.season_predictions
  for select using (
    ((select auth.uid()) = user_id)
    or (
      ((select auth.uid()) <> user_id)
      and locked_at is not null
      and public.shared_league(user_id)
    )
  );

create policy "own season predictions insert" on public.season_predictions
  for insert with check ((select auth.uid()) = user_id);

create policy "own season predictions update" on public.season_predictions
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own season predictions delete" on public.season_predictions
  for delete using ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1+2. items_played — own (ALL) + co-members after resolution (SELECT)
-- ─────────────────────────────────────────────────────────────────────────────

drop policy "own items played" on public.items_played;
drop policy "co-members after resolution" on public.items_played;

create policy "own or co-members after resolution" on public.items_played
  for select using (
    ((select auth.uid()) = user_id)
    or (
      ((select auth.uid()) <> user_id)
      and resolved_at is not null
      and public.is_member_of_league(league_id)
    )
  );

create policy "own items played insert" on public.items_played
  for insert with check ((select auth.uid()) = user_id);

create policy "own items played update" on public.items_played
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own items played delete" on public.items_played
  for delete using ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1+2. profiles — own profile (ALL) + league members see bio (SELECT)
-- ─────────────────────────────────────────────────────────────────────────────

drop policy "own profile" on public.profiles;
drop policy "league members see bio" on public.profiles;

create policy "own or league members see bio" on public.profiles
  for select using (
    ((select auth.uid()) = id)
    or public.shared_league(id)
  );

create policy "own profile insert" on public.profiles
  for insert with check ((select auth.uid()) = id);

create policy "own profile update" on public.profiles
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "own profile delete" on public.profiles
  for delete using ((select auth.uid()) = id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Initplan seul (pas de doublon SELECT sur ces tables) — recréation à
--    l'identique, seul auth.uid() → (select auth.uid()) change.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy "own subscriptions" on public.push_subscriptions;
create policy "own subscriptions" on public.push_subscriptions
  for all using ((select auth.uid()) = user_id);

drop policy "own items" on public.user_items;
create policy "own items" on public.user_items
  for all using ((select auth.uid()) = user_id);

drop policy "user_season_items: read own" on public.user_season_items;
create policy "user_season_items: read own" on public.user_season_items
  for select using ((select auth.uid()) = user_id);

drop policy "user joins league" on public.league_members;
create policy "user joins league" on public.league_members
  for insert with check ((select auth.uid()) = user_id);

drop policy "admins manage members" on public.league_members;
create policy "admins manage members" on public.league_members
  for update using (
    exists (
      select 1 from public.league_members lm
      where lm.league_id = league_members.league_id
        and lm.user_id = (select auth.uid())
        and lm.is_admin = true
    )
  );

drop policy "admins update league" on public.leagues;
create policy "admins update league" on public.leagues
  for update using (
    exists (
      select 1 from public.league_members
      where league_members.league_id = leagues.id
        and league_members.user_id = (select auth.uid())
        and league_members.is_admin = true
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3a. Index manquants sur foreign keys (advisor unindexed_foreign_keys).
--     Vérifié : aucune de ces colonnes n'est en 1ʳᵉ position d'un index existant.
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists scores_session_id_idx              on public.scores (session_id);
create index if not exists session_results_driver_id_idx      on public.session_results (driver_id);
create index if not exists fastest_lap_predictions_session_id_idx on public.fastest_lap_predictions (session_id);
create index if not exists fastest_lap_predictions_driver_id_idx  on public.fastest_lap_predictions (driver_id);
create index if not exists items_played_gp_id_idx             on public.items_played (gp_id);
create index if not exists user_items_league_id_idx           on public.user_items (league_id);
create index if not exists season_scores_league_id_idx        on public.season_scores (league_id);
create index if not exists push_subscriptions_user_id_idx     on public.push_subscriptions (user_id);
create index if not exists drivers_constructor_id_idx         on public.drivers (constructor_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3b. Drop de l'index doublon (advisor unused_index) : sessions_gp_type_idx
--     couvre (gp_id, type), colonnes déjà indexées par la contrainte UNIQUE
--     sessions_gp_id_type_key — le planner utilise l'index unique, celui-ci
--     ne sert jamais.
-- ─────────────────────────────────────────────────────────────────────────────

drop index if exists public.sessions_gp_type_idx;
