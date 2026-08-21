-- #211 : distinguer un pilote réellement OBSERVÉ en piste ce week-end (session
-- « fiable » au sens de LINEUP_SESSION_TRUST_DELAY_MS — démarrée depuis assez
-- longtemps pour que son /drivers OpenF1 reflète les participants réels) du
-- simple pré-seed nominal. null = jamais vu sur une session fiable de ce GP.
-- Sert au signal « absent du week-end ? » et à l'écurie affichée dans la liste
-- de pronos ; la baseline inter-GP (diff de line-up) continue d'utiliser toutes
-- les lignes, observées ou non.
alter table public.gp_lineups add column observed_at timestamptz;
