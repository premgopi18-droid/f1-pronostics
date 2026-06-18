-- Durcit les fonctions trigger de `league_members` pour qu'elles fonctionnent
-- quel que soit le `search_path` de l'appelant.
--
-- Bug latent : `enforce_max_members` et `enforce_min_one_admin` référençaient
-- `league_members` / `leagues` SANS schéma et n'avaient pas de `search_path` fixe.
-- Or toutes les RPC `SECURITY DEFINER` du projet tournent avec `search_path = ''`
-- (convention sécurité). Quand une telle RPC écrit dans `league_members`, le
-- trigger hérite de ce `search_path` vide et échoue : « relation "league_members"
-- does not exist ». Concrètement, `delete_own_account` (UPDATE is_admin) et
-- `create_league` (INSERT membre) étaient cassés par cette résolution de noms.
--
-- Correctif (logique inchangée) : noms pleinement qualifiés + `search_path = ''`
-- propre à chaque fonction → robustes et auto-contenues.

create or replace function public.enforce_max_members()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_count integer;
  max_allowed   integer;
begin
  select count(*) into current_count
  from public.league_members
  where league_id = new.league_id and season = new.season;

  select max_members into max_allowed
  from public.leagues where id = new.league_id;

  if current_count >= max_allowed then
    raise exception 'La ligue est pleine (max % membres).', max_allowed;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_min_one_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_admin = true and new.is_admin = false then
    if not exists (
      select 1 from public.league_members
      where league_id = new.league_id and season = new.season
        and is_admin = true and id <> new.id
    ) then
      raise exception 'La ligue doit avoir au moins un administrateur.';
    end if;
  end if;
  return new;
end;
$$;
