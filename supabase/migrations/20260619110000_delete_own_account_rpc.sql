-- Suppression de compte (RGPD) — fonction transactionnelle.
-- Appelée côté serveur via le client authentifié (`supabase.rpc('delete_own_account')`).
-- SECURITY DEFINER : encapsule en UNE transaction le transfert d'admin,
-- l'anonymisation du profil et l'effacement des données d'auth (email + métadonnées
-- OAuth + identités). Tout est scopé sur `auth.uid()` — aucun id n'est injectable,
-- donc pas d'IDOR possible. `search_path = ''` + objets pleinement qualifiés pour
-- éviter tout détournement de résolution de noms.
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

  -- 2. Anonymisation du profil. Les lignes scores/league_members restent (FK
  --    NO ACTION) pour l'intégrité du classement, mais sans PII. Le pseudo neutre
  --    libère la contrainte UNIQUE ; l'UI affiche « Compte supprimé » via is_deleted.
  update public.profiles
  set pseudo     = 'Compte supprimé ' || substr(v_user::text, 1, 8),
      avatar_key = null,
      is_deleted = true,
      deleted_at = now()
  where id = v_user;

  -- 3. Effacement des données d'auth : email + métadonnées OAuth neutralisés sur
  --    auth.users, puis suppression des identités (Google). La ligne auth.users
  --    subsiste (sa suppression cascaderait sur profiles, bloquée par les FK des
  --    scores), mais devient non-connectable — une future connexion Google recrée
  --    un compte neuf (vrai « fresh start ») et l'email d'origine est libéré.
  update auth.users
  set email              = 'deleted+' || v_user::text || '@deleted.invalid',
      phone              = null,
      raw_user_meta_data = '{}'::jsonb
  where id = v_user;

  delete from auth.identities where user_id = v_user;
end;
$$;

-- Exécutable uniquement par un utilisateur authentifié (et jamais en direct par
-- anon). Le corps tourne en DEFINER, donc avec les droits d'écriture sur auth.
revoke all on function public.delete_own_account(integer) from public, anon, authenticated;
grant execute on function public.delete_own_account(integer) to authenticated;
