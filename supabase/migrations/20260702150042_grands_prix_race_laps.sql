-- Nombre de tours de la course d'un GP, dérivé des résultats F1 (tours du vainqueur).
-- Rempli automatiquement par le cron /api/f1/sync à la confirmation de la course, et
-- backfillé pour les éditions passées. La page de pronostic lit la valeur de la
-- dernière édition disputée du circuit → plus de mapping de tours saisi à la main.
-- Voir issue #174 et product-specs §3.3.

alter table public.grands_prix
  add column if not exists race_laps integer;
