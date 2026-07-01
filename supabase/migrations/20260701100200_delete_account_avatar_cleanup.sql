-- Suite de 20260620140000 — l'anonymisation doit aussi retirer la photo d'avatar
-- (colonne `avatar_url` ajoutée en 20260701100000) et effacer le(s) fichier(s)
-- correspondant(s) dans Storage. Sinon la photo resterait accessible via son URL
-- publique après suppression du compte. Tout reste dans le RPC transactionnel.

create or replace function public.delete_own_account()
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
      avatar_url = null,
      is_deleted = true,
      deleted_at = now()
  where id = v_user;

  -- 2b. Effacer la (les) photo(s) d'avatar dans Storage (dossier {user_id}/).
  delete from storage.objects
  where bucket_id = 'avatars'
    and (storage.foldername(name))[1] = v_user::text;

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

revoke all on function public.delete_own_account() from public, anon, authenticated;
grant execute on function public.delete_own_account() to authenticated;
