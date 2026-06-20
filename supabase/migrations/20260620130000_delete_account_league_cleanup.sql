-- Fix : delete_own_account ne supprimait pas league_members ni user_items →
-- l'utilisateur restait "membre fantôme" dans toutes ses ligues. Si Supabase
-- OAuth réutilisait le même UUID à la ré-inscription, le rejoindre échouait
-- avec "déjà membre". Même sans réutilisation d'UUID, le slot était bloqué.
-- Solution : supprimer les adhésions + inventaire d'items à la clôture du compte.
-- Les lignes scores/predictions/items_played restent (FK → auth.users.id,
-- pas → league_members) pour l'intégrité des calculs passés.
-- raw_app_meta_data vidé pour couper le lien OAuth résiduel côté Gotrue.

create or replace function public.delete_own_account(p_season integer)
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

  -- 1. Transfert d'admin : pour chaque ligue de la saison où l'utilisateur est
  --    admin, nommer le plus ancien membre encore actif, puis se retirer.
  for v_league in
    select league_id
    from public.league_members
    where user_id = v_user and season = p_season and is_admin = true
  loop
    select lm.user_id into v_next
    from public.league_members lm
    join public.profiles p on p.id = lm.user_id
    where lm.league_id = v_league.league_id
      and lm.season    = p_season
      and lm.user_id  <> v_user
      and p.is_deleted = false
    order by lm.joined_at asc
    limit 1;

    if v_next is not null then
      -- Nommer le successeur AVANT de se retirer (respecte le trigger « ≥1 admin »).
      update public.league_members set is_admin = true
        where league_id = v_league.league_id and season = p_season and user_id = v_next;
      update public.league_members set is_admin = false
        where league_id = v_league.league_id and season = p_season and user_id = v_user;
    end if;
  end loop;

  -- 1b. Retrait de toutes les ligues (toutes saisons) : libère les slots pour de
  --     nouveaux membres et permet le re-join si l'utilisateur crée un nouveau compte.
  delete from public.user_items     where user_id = v_user;
  delete from public.league_members where user_id = v_user;

  -- 2. Anonymisation du profil. Les lignes scores/predictions/items_played restent
  --    (FK NO ACTION) pour l'intégrité du classement, mais sans PII.
  update public.profiles
  set pseudo     = 'Compte supprimé ' || substr(v_user::text, 1, 8),
      avatar_key = null,
      is_deleted = true,
      deleted_at = now()
  where id = v_user;

  -- 3. Effacement des données d'auth : email + métadonnées OAuth + identités.
  --    raw_app_meta_data vidé pour supprimer le lien provider résiduel que
  --    Gotrue pourrait utiliser pour retrouver ce auth.users même sans identity.
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
revoke all on function public.delete_own_account(integer) from public, anon, authenticated;
grant execute on function public.delete_own_account(integer) to authenticated;
