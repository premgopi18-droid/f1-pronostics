-- Étend la contrainte de type des sessions aux essais libres (EL1/EL2/EL3).
-- Le code (DbSessionType, /api/f1/sync) insère ces sessions depuis #117, mais la
-- contrainte d'origine ne listait que les 4 sessions scorées — toute la sync
-- échouait donc avec « violates check constraint "sessions_type_check" ».
-- Idempotent : DROP IF EXISTS puis recréation.

alter table public.sessions
  drop constraint if exists sessions_type_check;

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
