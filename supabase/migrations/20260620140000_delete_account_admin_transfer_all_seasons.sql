-- Suite de 20260620130000 (delete_account_league_cleanup) — correctif du scope
-- du transfert d'admin.
--
-- Bug : la suppression de `league_members` est toutes-saisons, mais le transfert
-- d'admin ne couvrait que `p_season`. Une ligue où l'utilisateur était admin dans
-- une AUTRE saison (ex. admin 2025, suppression en 2026) se retrouvait sans admin :
-- son row admin était supprimé sans successeur, et `enforce_min_one_admin` ne se
-- déclenche que sur UPDATE (il lit `old`/`new`), pas sur DELETE → aucun garde-fou.
--
-- Correctif : le transfert itère désormais sur CHAQUE (league_id, season) où
-- l'utilisateur est admin, en nommant un successeur de la MÊME saison avant le
-- DELETE global. `p_season` devient inutile (tout est toutes-saisons) → paramètre
-- retiré (drop + recreate, la signature change).

drop function if exists public.delete_own_account(integer);

create function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := auth.uid();
  v_league record;
  v_next   uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  -- 1. Transfert d'admin : pour CHAQUE (ligue, saison) où l'utilisateur est admin,
  --    nommer le plus ancien membre encore actif de cette même saison, puis se retirer.
  for v_league in
    select league_id, season
    from public.league_members
    where user_id = v_user and is_admin = true
  loop
    select lm.user_id into v_next
    from public.league_members lm
    join public.profiles p on p.id = lm.user_id
    where lm.league_id = v_league.league_id
      and lm.season    = v_league.season
      and lm.user_id  <> v_user
      and p.is_deleted = false
    order by lm.joined_at asc
    limit 1;

    if v_next is not null then
      -- Nommer le successeur AVANT de se retirer (respecte le trigger « ≥1 admin »).
      update public.league_members set is_admin = true
        where league_id = v_league.league_id and season = v_league.season and user_id = v_next;
      update public.league_members set is_admin = false
        where league_id = v_league.league_id and season = v_league.season and user_id = v_user;
    end if;
  end loop;

  -- 1b. Retrait de toutes les ligues (toutes saisons) : libère les slots pour de
  --     nouveaux membres et permet le re-join si l'utilisateur crée un nouveau compte.
  delete from public.user_items     where user_id = v_user;
  delete from public.league_members where user_id = v_user;

  -- 2. Anonymisation du profil. Les lignes scores/predictions/items_played restent
  --    (FK → auth.users.id) pour l'intégrité des calculs passés, mais sans PII.
  update public.profiles
  set pseudo     = 'Compte supprimé ' || substr(v_user::text, 1, 8),
      avatar_key = null,
      is_deleted = true,
      deleted_at = now()
  where id = v_user;

  -- 3. Effacement des données d'auth : email + métadonnées OAuth + identités.
  --    raw_app_meta_data vidé pour supprimer le lien provider résiduel côté Gotrue.
  update auth.users
  set email              = 'deleted+' || v_user::text || '@deleted.invalid',
      phone              = null,
      raw_user_meta_data = '{}'::jsonb,
      raw_app_meta_data  = '{}'::jsonb
  where id = v_user;

  delete from auth.identities where user_id = v_user;

  -- 4. Effacer les souscriptions push (pas de cascade auto — profiles reste).
  delete from public.push_subscriptions where user_id = v_user;
end;
$$;

-- Maintien des droits identiques à la version précédente.
revoke all on function public.delete_own_account() from public, anon, authenticated;
grant execute on function public.delete_own_account() to authenticated;
