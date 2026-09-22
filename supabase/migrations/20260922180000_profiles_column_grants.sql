-- #249 : verrouiller les colonnes de public.profiles que l'utilisateur ne doit pas
-- piloter. Découvert en passe adversariale de #247 : la policy « own profile update »
-- autorisait l'UPDATE de TOUTES les colonnes de sa propre ligne (aucun grant colonne,
-- aucun trigger de garde), et les grants par défaut donnaient aussi INSERT/DELETE.
-- Un joueur pouvait donc, avec son JWT, réécrire `created_at` (référence potentielle
-- de la deadline saison per-user), `is_deleted`/`deleted_at` (état incohérent hors du
-- RPC delete_own_account), ou supprimer puis réinsérer sa ligne avec une fausse date.
--
-- Principe : la RLS filtre les LIGNES, les grants colonne filtrent les COLONNES.
-- Les deux se cumulent. `service_role` (lib/data, crons) et le trigger d'inscription
-- `handle_new_user` (SECURITY DEFINER, owner postgres) ne sont pas concernés.

-- 1. Plus d'INSERT ni de DELETE par les rôles applicatifs : la ligne est créée par le
--    trigger d'inscription et anonymisée (jamais supprimée) par le RPC delete_own_account.
--    `anon` n'a de toute façon aucune policy (auth.uid() null) — hygiène.
revoke insert, update, delete on public.profiles from anon, authenticated;

-- 2. UPDATE restreint aux colonnes que les Server Actions écrivent avec le client
--    cookie/RLS (app/actions/profile.ts, onboarding.ts, notification-preferences.ts).
--    Exclues : id, created_at, is_deleted, deleted_at.
grant update (
  pseudo,
  avatar_key,
  avatar_url,
  notif_imminence_scope,
  notif_announcements,
  onboarding_completed,
  updated_at
) on public.profiles to authenticated;

-- 3. Policies INSERT / DELETE devenues sans objet (le grant manque) : supprimées pour
--    ne pas laisser croire que ces opérations sont possibles côté utilisateur.
drop policy if exists "own profile insert" on public.profiles;
drop policy if exists "own profile delete" on public.profiles;
