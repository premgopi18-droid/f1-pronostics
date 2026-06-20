-- ============================================================
-- initial_schema — état de la DB à la création du projet
-- Version : 20260615134501 (correspond à la migration Supabase)
--
-- Contient : 16 tables, fonctions helper + trigger, RLS, indexes.
-- Ce qui N'est PAS ici et qui est ajouté par les migrations suivantes :
--   · RPCs create_league, play_item, apply_season_item, delete_own_account
--   · table user_season_items (20260617140000)
--   · UNIQUE nommés constructors/drivers/grands_prix/sessions (20260616230000)
--   · UNIQUE push_subscriptions.endpoint (20260617160000)
--   · colonnes grands_prix.notified_open_at/scores_at (20260617160000)
--   · colonnes sessions.notified_deadline_at/provisional_at (20260620120000)
--   · check max_members abaissé à 2 (20260619100000)
--   · durcissement search_path/qualif des triggers league_members (20260619120000)
-- ============================================================

-- Note : les helpers RLS `is_member_of_league` / `shared_league` (language sql)
-- sont définis plus bas, APRÈS les tables : leur corps SQL est validé dès le
-- CREATE (check_function_bodies = on) et référence `public.league_members`.
-- Les fonctions trigger ci-dessous sont en plpgsql (corps non validé au CREATE),
-- donc peuvent précéder les tables.

-- ── Fonctions trigger ─────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, pseudo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'pseudo', 'user_' || left(new.id::text, 8))
  );
  return new;
end;
$$;

-- État de création : noms non qualifiés, sans search_path fixe.
-- Durcies (public.* + set search_path = '') par 20260619120000_harden_league_member_triggers.
create or replace function public.enforce_max_members()
returns trigger
language plpgsql
as $$
declare
  current_count integer;
  max_allowed   integer;
begin
  select count(*) into current_count
  from league_members
  where league_id = new.league_id and season = new.season;

  select max_members into max_allowed
  from leagues where id = new.league_id;

  if current_count >= max_allowed then
    raise exception 'La ligue est pleine (max % membres).', max_allowed;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_min_one_admin()
returns trigger
language plpgsql
as $$
begin
  if old.is_admin = true and new.is_admin = false then
    if not exists (
      select 1 from league_members
      where league_id = new.league_id and season = new.season
        and is_admin = true and id <> new.id
    ) then
      raise exception 'La ligue doit avoir au moins un administrateur.';
    end if;
  end if;
  return new;
end;
$$;

-- ── Tables (ordre FK) ─────────────────────────────────────

create table if not exists public.profiles (
  id         uuid        not null primary key references auth.users on delete cascade,
  pseudo     text        not null unique,
  avatar_key text,
  is_deleted bool        not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leagues (
  id          uuid        not null default gen_random_uuid() primary key,
  name        text        not null,
  invite_code text        not null unique,
  invite_open bool        not null default true,
  max_members int         not null constraint leagues_max_members_check check (max_members between 3 and 20),
  created_at  timestamptz not null default now()
);

create table if not exists public.constructors (
  id         uuid        not null default gen_random_uuid() primary key,
  season     int         not null,
  code       text        not null,
  name       text        not null,
  created_at timestamptz not null default now()
  -- contrainte UNIQUE (season, code) ajoutée nommément par 20260616230000
);

create table if not exists public.drivers (
  id             uuid        not null default gen_random_uuid() primary key,
  season         int         not null,
  code           text        not null,
  first_name     text        not null,
  last_name      text        not null,
  number         int,
  constructor_id uuid        references public.constructors(id),
  created_at     timestamptz not null default now()
  -- contrainte UNIQUE (season, code) ajoutée nommément par 20260616230000
);

-- sans notified_open_at / notified_scores_at (ajoutés par 20260617160000)
create table if not exists public.grands_prix (
  id                   uuid        not null default gen_random_uuid() primary key,
  season               int         not null,
  round                int         not null,
  name                 text        not null,
  circuit              text        not null,
  country              text        not null,
  is_sprint_weekend    bool        not null default false,
  is_cancelled         bool        not null default false,
  weekend_starts_at    timestamptz,
  scoring_finalized_at timestamptz,
  created_at           timestamptz not null default now()
  -- contrainte UNIQUE (season, round) ajoutée nommément par 20260616230000
);

-- sans notified_deadline_at / notified_provisional_at (ajoutés par 20260620120000)
create table if not exists public.sessions (
  id                   uuid        not null default gen_random_uuid() primary key,
  gp_id                uuid        not null references public.grands_prix(id),
  season               int         not null,
  type                 text        not null,
  starts_at            timestamptz not null,
  results_confirmed_at timestamptz,
  created_at           timestamptz not null default now()
  -- contrainte UNIQUE (gp_id, type) ajoutée nommément par 20260616230000
);

create table if not exists public.league_members (
  id        uuid        not null default gen_random_uuid() primary key,
  league_id uuid        not null references public.leagues(id),
  user_id   uuid        not null references public.profiles(id),
  season    int         not null,
  is_admin  bool        not null default false,
  joined_at timestamptz not null default now(),
  unique (league_id, user_id, season)
);

create table if not exists public.predictions (
  id           uuid        not null default gen_random_uuid() primary key,
  user_id      uuid        not null references public.profiles(id),
  session_id   uuid        not null references public.sessions(id),
  season       int         not null,
  entries      jsonb       not null,
  submitted_at timestamptz not null default now(),
  is_valid     bool        not null default false,
  unique (user_id, session_id)
);

create table if not exists public.fastest_lap_predictions (
  id           uuid        not null default gen_random_uuid() primary key,
  user_id      uuid        not null references public.profiles(id),
  session_id   uuid        not null references public.sessions(id),
  season       int         not null,
  driver_id    uuid        not null references public.drivers(id),
  submitted_at timestamptz not null default now(),
  unique (user_id, session_id)
);

-- league_id NOT NULL initialement — rendu nullable par 20260617140000
create table if not exists public.items_played (
  id             uuid        not null default gen_random_uuid() primary key,
  user_id        uuid        not null references public.profiles(id),
  league_id      uuid        not null references public.leagues(id),
  season         int         not null,
  item_type      text        not null,
  gp_id          uuid        references public.grands_prix(id),
  payload        jsonb       not null default '{}',
  played_at      timestamptz not null default now(),
  resolved_at    timestamptz,
  was_shielded   bool,
  effect_applied bool
);

create table if not exists public.scores (
  id              uuid        not null default gen_random_uuid() primary key,
  user_id         uuid        not null references public.profiles(id),
  league_id       uuid        not null references public.leagues(id),
  session_id      uuid        not null references public.sessions(id),
  season          int         not null,
  base_score      int         not null default 0,
  final_score     int         not null default 0,
  exact_positions int         not null default 0,
  breakdown       jsonb       not null default '{}',
  computed_at     timestamptz not null default now(),
  unique (user_id, league_id, session_id)
);

create table if not exists public.season_predictions (
  id           uuid        not null default gen_random_uuid() primary key,
  user_id      uuid        not null references public.profiles(id),
  season       int         not null,
  type         text        not null,
  entries      jsonb       not null,
  submitted_at timestamptz not null default now(),
  locked_at    timestamptz,
  unique (user_id, season, type)
);

create table if not exists public.season_scores (
  id          uuid        not null default gen_random_uuid() primary key,
  user_id     uuid        not null references public.profiles(id),
  league_id   uuid        not null references public.leagues(id),
  season      int         not null,
  wdc_score   int         not null default 0,
  wdc_bonus   int         not null default 0,
  wcc_score   int         not null default 0,
  wcc_bonus   int         not null default 0,
  total       int,
  computed_at timestamptz not null default now(),
  unique (user_id, league_id, season)
);

create table if not exists public.session_results (
  id          uuid        not null default gen_random_uuid() primary key,
  session_id  uuid        not null references public.sessions(id),
  season      int         not null,
  driver_id   uuid        not null references public.drivers(id),
  position    int,
  dnf         bool        not null default false,
  fastest_lap bool        not null default false,
  created_at  timestamptz not null default now(),
  unique (session_id, driver_id)
);

-- sans contrainte UNIQUE nommée sur endpoint (ajoutée par 20260617160000)
create table if not exists public.push_subscriptions (
  id         uuid        not null default gen_random_uuid() primary key,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  endpoint   text        not null,
  p256dh     text        not null,
  auth_key   text        not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_items (
  id             uuid not null default gen_random_uuid() primary key,
  user_id        uuid not null references public.profiles(id),
  league_id      uuid not null references public.leagues(id),
  season         int  not null,
  item_type      text not null,
  uses_remaining int  not null,
  unique (user_id, league_id, season, item_type)
);

-- user_season_items créée séparément par 20260617140000_season_items_and_apply_rpc

-- ── Indexes non-contrainte ────────────────────────────────

create index if not exists lm_league_season_idx
  on public.league_members (league_id, season);

create index if not exists lm_user_season_idx
  on public.league_members (user_id, season);

create index if not exists predictions_session_idx
  on public.predictions (session_id);

create index if not exists sessions_season_idx
  on public.sessions (season, starts_at);

create index if not exists sessions_gp_type_idx
  on public.sessions (gp_id, type);

create index if not exists scores_league_season_idx
  on public.scores (league_id, season);

create index if not exists scores_user_league_season_idx
  on public.scores (user_id, league_id, season);

create index if not exists user_items_user_league_season_idx
  on public.user_items (user_id, league_id, season);

create index if not exists items_played_league_gp_idx
  on public.items_played (league_id, gp_id, season);

-- Un seul item GP par (user, ligue) par week-end. Partiel : exclut les items
-- saison (gp_id IS NULL) qui n'ont pas de contrainte d'unicité par GP.
create unique index if not exists items_played_one_per_gp_slot
  on public.items_played (user_id, league_id, gp_id)
  where gp_id is not null;

-- ── Fonctions helper RLS ──────────────────────────────────
-- Définies ici (après les tables) car le corps des fonctions `language sql` est
-- validé dès le CREATE et référence `public.league_members`.

create or replace function public.is_member_of_league(check_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.league_members
    where league_id = check_league_id and user_id = auth.uid()
  );
$$;

create or replace function public.shared_league(other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.league_members lm1
    join public.league_members lm2
      on lm1.league_id = lm2.league_id and lm1.season = lm2.season
    where lm1.user_id = auth.uid()
      and lm2.user_id = other_user_id
  );
$$;

-- ── RLS ────────────────────────────────────────────────────

alter table public.profiles              enable row level security;
alter table public.leagues               enable row level security;
alter table public.league_members        enable row level security;
alter table public.constructors          enable row level security;
alter table public.drivers               enable row level security;
alter table public.grands_prix           enable row level security;
alter table public.sessions              enable row level security;
alter table public.predictions           enable row level security;
alter table public.fastest_lap_predictions enable row level security;
alter table public.items_played          enable row level security;
alter table public.scores                enable row level security;
alter table public.season_predictions    enable row level security;
alter table public.season_scores         enable row level security;
alter table public.session_results       enable row level security;
alter table public.push_subscriptions    enable row level security;
alter table public.user_items            enable row level security;

-- profiles
drop policy if exists "own profile" on public.profiles;
create policy "own profile"
  on public.profiles for all
  using (auth.uid() = id);

drop policy if exists "league members see bio" on public.profiles;
create policy "league members see bio"
  on public.profiles for select
  using (public.shared_league(id));

-- leagues
drop policy if exists "members read league" on public.leagues;
create policy "members read league"
  on public.leagues for select
  using (public.is_member_of_league(id));

drop policy if exists "admins update league" on public.leagues;
create policy "admins update league"
  on public.leagues for update
  using (exists (
    select 1 from public.league_members
    where league_id = leagues.id and user_id = auth.uid() and is_admin = true
  ));

-- league_members
drop policy if exists "members read roster" on public.league_members;
create policy "members read roster"
  on public.league_members for select
  using (public.is_member_of_league(league_id));

drop policy if exists "user joins league" on public.league_members;
create policy "user joins league"
  on public.league_members for insert
  with check (auth.uid() = user_id);

drop policy if exists "admins manage members" on public.league_members;
create policy "admins manage members"
  on public.league_members for update
  using (exists (
    select 1 from public.league_members lm
    where lm.league_id = league_members.league_id
      and lm.user_id = auth.uid()
      and lm.is_admin = true
  ));

-- données publiques F1
drop policy if exists "public read" on public.constructors;
create policy "public read" on public.constructors    for select using (true);
drop policy if exists "public read" on public.drivers;
create policy "public read" on public.drivers         for select using (true);
drop policy if exists "public read" on public.grands_prix;
create policy "public read" on public.grands_prix     for select using (true);
drop policy if exists "public read" on public.sessions;
create policy "public read" on public.sessions        for select using (true);
drop policy if exists "public read" on public.session_results;
create policy "public read" on public.session_results for select using (true);

-- predictions
drop policy if exists "own predictions" on public.predictions;
create policy "own predictions"
  on public.predictions for all
  using (auth.uid() = user_id);

drop policy if exists "co-members after lock" on public.predictions;
create policy "co-members after lock"
  on public.predictions for select
  using (
    auth.uid() <> user_id
    and exists (
      select 1 from public.sessions
      where id = predictions.session_id and starts_at < now()
    )
    and public.shared_league(user_id)
  );

-- fastest_lap_predictions
drop policy if exists "own fl predictions" on public.fastest_lap_predictions;
create policy "own fl predictions"
  on public.fastest_lap_predictions for all
  using (auth.uid() = user_id);

drop policy if exists "co-members fl after lock" on public.fastest_lap_predictions;
create policy "co-members fl after lock"
  on public.fastest_lap_predictions for select
  using (
    auth.uid() <> user_id
    and exists (
      select 1 from public.sessions
      where id = fastest_lap_predictions.session_id and starts_at < now()
    )
    and public.shared_league(user_id)
  );

-- scores
drop policy if exists "league members read scores" on public.scores;
create policy "league members read scores"
  on public.scores for select
  using (public.is_member_of_league(league_id));

-- items_played
drop policy if exists "own items played" on public.items_played;
create policy "own items played"
  on public.items_played for all
  using (auth.uid() = user_id);

drop policy if exists "co-members after resolution" on public.items_played;
create policy "co-members after resolution"
  on public.items_played for select
  using (
    auth.uid() <> user_id
    and resolved_at is not null
    and public.is_member_of_league(league_id)
  );

-- season_predictions
drop policy if exists "own season predictions" on public.season_predictions;
create policy "own season predictions"
  on public.season_predictions for all
  using (auth.uid() = user_id);

drop policy if exists "co-members after lock" on public.season_predictions;
create policy "co-members after lock"
  on public.season_predictions for select
  using (
    auth.uid() <> user_id
    and locked_at is not null
    and public.shared_league(user_id)
  );

-- season_scores
drop policy if exists "league members read season scores" on public.season_scores;
create policy "league members read season scores"
  on public.season_scores for select
  using (public.is_member_of_league(league_id));

-- push_subscriptions
drop policy if exists "own subscriptions" on public.push_subscriptions;
create policy "own subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id);

-- user_items
drop policy if exists "own items" on public.user_items;
create policy "own items"
  on public.user_items for all
  using (auth.uid() = user_id);

-- ── Triggers ──────────────────────────────────────────────

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists check_max_members on public.league_members;
create trigger check_max_members
  before insert on public.league_members
  for each row execute function public.enforce_max_members();

drop trigger if exists check_min_admin on public.league_members;
create trigger check_min_admin
  before update on public.league_members
  for each row execute function public.enforce_min_one_admin();
