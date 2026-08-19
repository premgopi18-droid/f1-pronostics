-- Line-up observé d'un GP (pilote → écurie), importé d'OpenF1 (/drivers de la
-- première session du week-end disponible, EL1 dès le vendredi) par le cron de
-- sync. Sert à détecter les changements de baquet (#205) : diff contre le
-- line-up du GP précédent (même source OpenF1 — les libellés d'écurie ne
-- matchent pas ceux de Jolpica) et notification push agrégée avant la course.
-- team_name est le libellé OpenF1 brut (« Red Bull Racing »), PAS un code
-- interne : il ne sert qu'à la comparaison OpenF1 ↔ OpenF1 et à l'affichage.
-- notified_at NULL = changement pas encore notifié (claim atomique par pilote).

create table if not exists public.gp_lineups (
  id          uuid        not null default gen_random_uuid() primary key,
  gp_id       uuid        not null references public.grands_prix(id) on delete cascade,
  season      int         not null,
  driver_id   uuid        not null references public.drivers(id),
  team_name   text        not null,
  detected_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (gp_id, driver_id)
);

alter table public.gp_lineups enable row level security;

-- Donnée F1 publique, même politique que session_results / starting_grids.
create policy "public read" on public.gp_lineups for select using (true);

-- Index FK (la contrainte unique couvre déjà les lookups par gp_id).
create index if not exists gp_lineups_driver_id_idx on public.gp_lineups (driver_id);
