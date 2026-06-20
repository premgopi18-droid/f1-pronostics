-- Toggle atomique des inscriptions d'une ligue.
--
-- Remplace le read-modify-write (`select invite_open` puis `update !value`) côté
-- Server Action, qui (a) n'était pas atomique — deux admins concurrents pouvaient
-- se neutraliser — et (b) renvoyait un état que le client devait inférer, d'où des
-- divergences UI quand l'onglet était périmé (cf. #23).
--
-- `update ... set invite_open = not invite_open ... returning invite_open` : un seul
-- statement → atomique, et renvoie l'état réel pour que le client l'applique tel quel.
--
-- SECURITY INVOKER (défaut) : l'écriture est gouvernée par la policy RLS
-- "admins update league". Un non-admin toggle 0 ligne → la fonction renvoie NULL.
-- `assertAdmin` côté action reste le garde-fou principal (défense en profondeur).
create or replace function public.toggle_invites(p_league_id uuid)
returns boolean
language sql
set search_path = ''
as $$
  update public.leagues
     set invite_open = not invite_open
   where id = p_league_id
  returning invite_open;
$$;

-- Appelée par l'admin authentifié via le client cookie (RLS appliqué).
revoke all on function public.toggle_invites(uuid) from public, anon;
grant execute on function public.toggle_invites(uuid) to authenticated;
