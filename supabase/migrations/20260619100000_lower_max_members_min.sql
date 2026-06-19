-- Abaisse le minimum de membres d'une ligue de 3 à 2.
-- L'ancienne contrainte `CHECK (max_members BETWEEN 3 AND 20)` rejetait toute
-- ligue à 2 joueurs ; on la remplace pour aligner la base sur la validation
-- applicative (form + Server Action) et la spec (groupes de 2 à 20).
ALTER TABLE public.leagues DROP CONSTRAINT IF EXISTS leagues_max_members_check;
ALTER TABLE public.leagues
  ADD CONSTRAINT leagues_max_members_check CHECK (max_members BETWEEN 2 AND 20);
