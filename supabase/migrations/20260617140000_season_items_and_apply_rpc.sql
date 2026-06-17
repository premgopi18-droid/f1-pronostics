-- Items saison globaux (wdc_move / wcc_move) : 1 exemplaire par user par saison,
-- toutes ligues confondues (cf. product-specs §portée). Versionne la table créée
-- hors-bande + rend items_played.league_id nullable (les items saison ne sont liés
-- à aucune ligue) + ajoute la RPC transactionnelle d'application.

-- ── Table d'inventaire ──────────────────────────────────────────────────────

create table if not exists public.user_season_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  season         integer not null,
  item_type      text not null check (item_type in ('wdc_move', 'wcc_move')),
  uses_remaining integer not null default 1 check (uses_remaining >= 0),
  created_at     timestamptz default now(),
  unique (user_id, season, item_type)
);

alter table public.user_season_items enable row level security;

-- Lecture par le propriétaire uniquement. Les écritures passent par la RPC
-- (service role), jamais directement par le client → pas de policy write.
drop policy if exists "user_season_items: read own" on public.user_season_items;
create policy "user_season_items: read own"
  on public.user_season_items for select
  using (auth.uid() = user_id);

-- ── items_played : league_id nullable pour les items saison ──────────────────
-- Un item saison n'appartient à aucune ligue (portée globale). La contrainte
-- UNIQUE (user_id, league_id, gp_id) WHERE gp_id IS NOT NULL n'est pas affectée
-- (les items saison ont gp_id NULL, donc exclus).

alter table public.items_played alter column league_id drop not null;

-- ── RPC : appliquer un item saison ──────────────────────────────────────────
-- Décrément gardé du stock + pull-and-shift de season_predictions.entries +
-- insert du log items_played, le tout dans une seule transaction. Remplace
-- l'enchaînement upsert → insert → upsert côté serveur, qui pouvait laisser la
-- prédiction mutée sans décrément (échec partiel) ou sur-dépenser en concurrence.
-- Même modèle que public.play_item.

create or replace function public.apply_season_item(
  p_user_id   uuid,
  p_season    integer,
  p_item_type text,
  p_from      integer,
  p_to        integer
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_type    text;
  v_entries jsonb;
  v_len     integer;
  v_code    jsonb;
  v_new     jsonb;
  v_updated integer;
begin
  v_type := case when p_item_type = 'wdc_move' then 'wdc' else 'wcc' end;

  -- Crée la ligne d'inventaire si absente (défaut : 1 usage), puis décrément gardé.
  insert into public.user_season_items (user_id, season, item_type, uses_remaining)
  values (p_user_id, p_season, p_item_type, 1)
  on conflict (user_id, season, item_type) do nothing;

  update public.user_season_items
     set uses_remaining = uses_remaining - 1
   where user_id   = p_user_id
     and season    = p_season
     and item_type = p_item_type
     and uses_remaining > 0;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'item_exhausted' using errcode = 'P0001';
  end if;

  -- Prédiction existante requise.
  select entries into v_entries
    from public.season_predictions
   where user_id = p_user_id and season = p_season and type = v_type;

  if v_entries is null then
    raise exception 'no_prediction' using errcode = 'P0002';
  end if;

  v_len := jsonb_array_length(v_entries);
  if p_from < 1 or p_from > v_len or p_to < 1 or p_to > v_len or p_from = p_to then
    raise exception 'position_out_of_range' using errcode = 'P0003';
  end if;

  -- Pull-and-shift (1-based) : retire l'élément en p_from puis le réinsère en p_to.
  v_code := v_entries -> (p_from - 1);
  v_new  := v_entries - (p_from - 1);
  v_new  := jsonb_insert(v_new, array[(p_to - 1)::text], v_code);

  update public.season_predictions
     set entries = v_new
   where user_id = p_user_id and season = p_season and type = v_type;

  -- Log auditable (gp_id NULL = item saison, league_id NULL = global).
  insert into public.items_played (user_id, league_id, gp_id, season, item_type, payload)
  values (
    p_user_id, null, null, p_season, p_item_type,
    jsonb_build_object('code', v_code, 'from_position', p_from, 'to_position', p_to)
  );
end;
$$;

-- Appelée uniquement côté serveur (service role). Bloque l'exécution directe par
-- les clients pour ne pas contourner la validation des Server Actions.
revoke all on function public.apply_season_item(uuid, integer, text, integer, integer) from public, anon, authenticated;
grant execute on function public.apply_season_item(uuid, integer, text, integer, integer) to service_role;
