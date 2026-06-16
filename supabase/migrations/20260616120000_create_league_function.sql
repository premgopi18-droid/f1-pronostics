-- Fonction transactionnelle pour créer une ligue : insère la ligue, son admin et
-- l'inventaire d'items du créateur dans une seule transaction. Évite l'état
-- incohérent (ligue orpheline sans admin) qu'un enchaînement de 3 inserts côté
-- client pouvait laisser en cas d'échec intermédiaire.
--
-- Le code d'invitation est généré ici avec retry sur collision (invite_code UNIQUE).
-- Les items sont passés en jsonb pour garder ITEM_USES_PER_SEASON (TypeScript) comme
-- source unique : [{ "item_type": "shield", "uses_remaining": 3 }, ...].

create or replace function public.create_league(
  p_name        text,
  p_max_members integer,
  p_user_id     uuid,
  p_season      integer,
  p_items       jsonb
)
returns table (league_id uuid, invite_code text)
language plpgsql
set search_path = ''
as $$
declare
  v_league_id uuid;
  v_code      text;
  v_attempt   integer := 0;
begin
  -- Génération du code court (8 hex majuscules) avec retry sur collision UNIQUE
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.leagues (name, invite_code, invite_open, max_members)
      values (p_name, v_code, true, p_max_members)
      returning id into v_league_id;
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt >= 5 then
        raise exception 'Could not generate a unique invite code after % attempts', v_attempt;
      end if;
    end;
  end loop;

  insert into public.league_members (league_id, user_id, season, is_admin)
  values (v_league_id, p_user_id, p_season, true);

  insert into public.user_items (user_id, league_id, season, item_type, uses_remaining)
  select p_user_id, v_league_id, p_season,
         elem->>'item_type', (elem->>'uses_remaining')::integer
  from jsonb_array_elements(p_items) as elem;

  return query select v_league_id, v_code;
end;
$$;

-- Appelée uniquement côté serveur (service role). On bloque l'exécution directe
-- par les clients (anon/authenticated) pour ne pas contourner la validation des
-- Server Actions.
revoke all on function public.create_league(text, integer, uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.create_league(text, integer, uuid, integer, jsonb) to service_role;
