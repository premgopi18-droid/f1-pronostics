-- Grille de départ réelle (pénalités et pit lane inclus), importée d'OpenF1
-- (/starting_grid) par le cron de sync entre les qualifications et la course.
-- Sert au pré-remplissage du pronostic course (specs § 3.3).
-- session_id référence la session COURSE (race / sprint_race), pas la
-- qualification qui a produit la grille.

create table if not exists public.starting_grids (
  id         uuid        not null default gen_random_uuid() primary key,
  session_id uuid        not null references public.sessions(id) on delete cascade,
  season     int         not null,
  driver_id  uuid        not null references public.drivers(id),
  position   int         not null,
  created_at timestamptz not null default now(),
  unique (session_id, driver_id)
);

alter table public.starting_grids enable row level security;

-- Donnée F1 publique, même politique que session_results.
create policy "public read" on public.starting_grids for select using (true);

-- Index FK (la contrainte unique couvre déjà les lookups par session_id).
create index if not exists starting_grids_driver_id_idx on public.starting_grids (driver_id);
