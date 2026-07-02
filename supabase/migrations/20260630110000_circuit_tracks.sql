-- Tracés de circuits F1 (GeoJSON) — source: bacinger/f1-circuits.
-- Stockage JSONB portable (pas de lock-in Storage). Alimenté par
-- POST /api/admin/sync-circuits. Lecture publique (donnée non sensible).

create table if not exists public.circuit_tracks (
  id           text        not null primary key,  -- bacinger id, ex: "mc-1929"
  circuit_name text        not null unique,        -- bacinger Name, ex: "Circuit de Monaco"
  geojson      jsonb       not null,               -- Feature GeoJSON complète (geometry + properties)
  updated_at   timestamptz not null default now()
);

alter table public.circuit_tracks enable row level security;

create policy "public read" on public.circuit_tracks
  for select using (true);