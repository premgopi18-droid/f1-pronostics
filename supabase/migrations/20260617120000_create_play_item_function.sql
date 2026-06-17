-- Fonction transactionnelle pour jouer un item GP : décrémente le stock (garde
-- atomique uses_remaining > 0) et insère la ligne items_played dans une seule
-- transaction. Remplace l'ancien enchaînement insert → read → update côté serveur,
-- qui pouvait laisser un item joué sans décrément (échec partiel) ou sur-dépenser
-- un usage en cas de concurrence.
--
-- La contrainte UNIQUE (user_id, league_id, gp_id) WHERE gp_id IS NOT NULL fait
-- échouer l'insert si l'utilisateur a déjà joué ce week-end → toute la transaction
-- (décrément compris) est annulée.

create or replace function public.play_item(
  p_user_id   uuid,
  p_league_id uuid,
  p_gp_id     uuid,
  p_season    integer,
  p_item_type text,
  p_payload   jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_updated integer;
begin
  -- Décrément gardé : ne touche la ligne que s'il reste au moins un usage.
  update public.user_items
     set uses_remaining = uses_remaining - 1
   where user_id   = p_user_id
     and league_id = p_league_id
     and season    = p_season
     and item_type = p_item_type
     and uses_remaining > 0;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'item_exhausted' using errcode = 'P0001';
  end if;

  -- L'insert échoue (unique_violation) si un item GP est déjà joué ce week-end :
  -- la transaction entière est annulée, y compris le décrément ci-dessus.
  insert into public.items_played (user_id, league_id, gp_id, season, item_type, payload)
  values (p_user_id, p_league_id, p_gp_id, p_season, p_item_type, p_payload);
end;
$$;

-- Appelée uniquement côté serveur (service role). On bloque l'exécution directe
-- par les clients (anon/authenticated) pour ne pas contourner la validation des
-- Server Actions.
revoke all on function public.play_item(uuid, uuid, uuid, integer, text, jsonb) from public, anon, authenticated;
grant execute on function public.play_item(uuid, uuid, uuid, integer, text, jsonb) to service_role;
