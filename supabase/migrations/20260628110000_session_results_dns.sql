alter table public.session_results add column if not exists dns bool not null default false;
