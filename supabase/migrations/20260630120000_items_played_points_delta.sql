-- Effet chiffré d'un item, écrit par le moteur de résolution (lib/scoring/resolve-items.ts).
-- Deux colonnes plutôt qu'une seule signée : auto-documenté, robuste aux items asymétriques
-- (cf. issue #151). Nullable — l'historique résolu avant cette migration reste à null (backfill OK
-- avant lancement). Une future évolution multi-cibles passera par une table d'effets dédiée.
alter table public.items_played add column if not exists points_delta_actor  int;
alter table public.items_played add column if not exists points_delta_target int;
