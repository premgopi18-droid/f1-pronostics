-- Écurie du pilote pour CETTE session (code normalisé, ex. "RED_BULL"), issue des
-- résultats Jolpica (course, sprint, qualifications). Corrige l'attribution en cas
-- de remplacement ou d'échange de baquet en cours de saison (#205) : le mapping
-- saison drivers.constructor_id ne connaît qu'une écurie par pilote.
-- NULL pour les sessions issues d'OpenF1 (sprint qualif, essais libres).
alter table public.session_results add column if not exists constructor_code text;

-- Backfill de l'historique avec l'écurie saison du pilote — meilleure donnée
-- disponible pour les lignes antérieures à la migration. Restreint aux sessions
-- dont les résultats viennent de Jolpica : l'invariant « NULL pour les sessions
-- OpenF1 (sprint qualif, essais) » reste vrai aussi pour l'historique.
update public.session_results sr
set constructor_code = c.code
from public.drivers d
join public.constructors c on c.id = d.constructor_id
where sr.driver_id = d.id
  and sr.constructor_code is null
  and exists (
    select 1 from public.sessions s
    where s.id = sr.session_id
      and s.type in ('race', 'sprint_race', 'qualifying')
  );
