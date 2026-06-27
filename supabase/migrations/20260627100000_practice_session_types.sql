-- Étend la contrainte de type des sessions aux essais libres (EL1/EL2/EL3).
-- Le code (DbSessionType, /api/f1/sync) insère ces sessions depuis #117, mais la
-- contrainte en prod ne listait que les 4 sessions scorées — toute la sync
-- échouait donc avec « violates check constraint "sessions_type_check" ».
--
-- NB : cette contrainte avait été posée hors-migration directement en prod (elle
-- n'apparaît dans aucune migration antérieure — le schéma initial déclare juste
-- `type text not null`). Cette migration la codifie enfin dans le versionning ;
-- sur une base fraîche, le DROP IF EXISTS est un no-op et l'ADD la crée.
-- Idempotent : DROP IF EXISTS puis recréation.

alter table public.sessions
  drop constraint if exists sessions_type_check;

-- ⚠️ Doit rester en phase avec DbSessionType (lib/scoring/types.ts) : tout
-- nouveau type de session inséré par le code doit être ajouté ici, sinon la sync
-- recasse sur « violates check constraint ».
alter table public.sessions
  add constraint sessions_type_check
  check (type in (
    'qualifying',
    'race',
    'sprint_qualifying',
    'sprint_race',
    'practice_1',
    'practice_2',
    'practice_3'
  ));
