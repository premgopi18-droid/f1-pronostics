-- Sécurité (#178) — verrouille les fonctions SECURITY DEFINER exposées via
-- l'API REST (/rest/v1/rpc/<fn>). Advisors :
--   anon_security_definer_function_executable /
--   authenticated_security_definer_function_executable
--
-- Une fonction SECURITY DEFINER s'exécute avec les privilèges de son owner
-- (bypass RLS) : chaque EXECUTE accordé inutilement est de la surface
-- d'attaque gratuite. Grants relevés avant migration (pg_proc.proacl) :
--   handle_new_user()            → postgres, anon, authenticated, service_role
--   is_member_of_league(uuid)    → postgres, anon, authenticated, service_role
--   shared_league(uuid)          → postgres, anon, authenticated, service_role
--
-- NB : delete_own_account() et les RPC de jeu (apply_season_item, play_item…)
-- sont volontairement hors périmètre — leur EXECUTE `authenticated` est
-- fonctionnel (suppression de compte, items).

-- handle_new_user : fonction TRIGGER uniquement (création du profil à
-- l'inscription, trigger on auth.users). Personne ne doit pouvoir l'appeler
-- via /rest/v1/rpc/. Le trigger continue de fonctionner : il s'exécute avec
-- les droits du owner de la fonction, pas ceux de l'appelant.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Helpers RLS : évalués dans les policies avec les droits de l'utilisateur
-- qui requête → `authenticated` DOIT garder EXECUTE (sinon toutes les policies
-- qui les référencent échouent : plus aucune ligne visible pour les connectés).
-- `anon` n'en a aucun besoin : aucune policy accessible sans session ne les
-- utilise, et l'app redirige les non-connectés vers /login.
revoke execute on function public.is_member_of_league(uuid) from public, anon;
revoke execute on function public.shared_league(uuid) from public, anon;
