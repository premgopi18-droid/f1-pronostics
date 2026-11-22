-- #264 : défense en profondeur — retirer aux rôles applicatifs (anon, authenticated)
-- les droits d'écriture dont l'app n'a pas besoin. Même principe que #249 (profiles).
--
-- Constat : les grants par défaut de Supabase donnent INSERT/UPDATE/DELETE/TRUNCATE à
-- anon et authenticated sur toutes les tables, et le schéma initial a laissé des
-- policies d'écriture « propriétaire » (pronos, items…). Or toutes ces écritures passent
-- par le serveur : `service_role` (lib/data/*) ou des RPC appelées avec service_role
-- (play_item, create_league, apply_season_item…). La RLS « propriétaire » ne vérifie ni
-- verrouillage ni règle de jeu : seule la couche applicative les fait respecter.
--
-- Écritures légitimes avec le client cookie (rôle authenticated), CONSERVÉES :
--   • profiles            — UPDATE colonne-restreint (#249), inchangé ici
--   • push_subscriptions  — app/actions/push.ts (abonnement de l'appareil)
--   • leagues (UPDATE)    — app/actions/league-admin.ts (invite_code) + RPC toggle_invites
--                           (SECURITY INVOKER) — policy « admins update league »
--   • league_members (UPDATE) — app/actions/league-admin.ts (transfert d'admin)
--                           — policy « admins manage members »
--   • delete_own_account  — RPC SECURITY DEFINER, non concernée par les grants
--
-- Non concernés : service_role (crons, Server Actions via lib/data) et le rôle postgres
-- (dashboard Supabase, MCP) — ils passent outre la RLS et ne sont pas révoqués.
--
-- ⚠️ Les default privileges Supabase re-donnent tous les droits à anon/authenticated
-- sur chaque NOUVELLE table : penser à révoquer dans la migration qui la crée
-- (convention documentée dans docs/data-model.md).

-- 1. TRUNCATE n'est jamais utile aux rôles applicatifs (et il ignore la RLS) : hygiène.
revoke truncate on all tables in schema public from anon, authenticated;

-- 2. anon n'écrit jamais rien (toutes les écritures exigent une session).
revoke insert, update, delete on all tables in schema public from anon;

-- 3. Tables écrites uniquement côté serveur : plus aucune écriture par authenticated.
revoke insert, update, delete on
  public.predictions,
  public.fastest_lap_predictions,
  public.season_predictions,
  public.items_played,
  public.user_items,
  public.user_season_items,
  public.scores,
  public.season_scores,
  public.sessions,
  public.session_results,
  public.grands_prix,
  public.drivers,
  public.constructors,
  public.circuit_tracks,
  public.gp_lineups,
  public.starting_grids,
  public.announcements
from authenticated;

-- 4. Ligues : création (RPC create_league) et adhésion (lib/data/leagues.ts) passent par
--    service_role ; aucune suppression côté app. Seul l'UPDATE admin reste ouvert.
revoke insert, delete on public.leagues, public.league_members from authenticated;

-- 5. Policies d'écriture devenues sans objet (le grant manque) : supprimées pour ne pas
--    laisser croire que ces opérations sont possibles côté utilisateur.
drop policy if exists "own predictions insert"           on public.predictions;
drop policy if exists "own predictions update"           on public.predictions;
drop policy if exists "own predictions delete"           on public.predictions;
drop policy if exists "own fl predictions insert"        on public.fastest_lap_predictions;
drop policy if exists "own fl predictions update"        on public.fastest_lap_predictions;
drop policy if exists "own fl predictions delete"        on public.fastest_lap_predictions;
drop policy if exists "own season predictions insert"    on public.season_predictions;
drop policy if exists "own season predictions update"    on public.season_predictions;
drop policy if exists "own season predictions delete"    on public.season_predictions;
drop policy if exists "own items played insert"          on public.items_played;
drop policy if exists "own items played update"          on public.items_played;
drop policy if exists "own items played delete"          on public.items_played;
drop policy if exists "user joins league"                on public.league_members;

-- 6. user_items : la policy « own items » (FOR ALL) servait aussi à la LECTURE
--    (app/leagues/[id]/page.tsx lit ses items restants avec le client cookie).
--    Remplacée par une policy SELECT seule, même condition.
drop policy if exists "own items" on public.user_items;
create policy "own items read" on public.user_items
  for select using ((select auth.uid()) = user_id);
