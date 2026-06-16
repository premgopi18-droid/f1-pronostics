-- Contraintes UNIQUE requises par PostgREST pour les upserts ON CONFLICT
-- Tables F1 (sync Jolpica) — manquaient à la création du schéma initial

ALTER TABLE constructors ADD CONSTRAINT constructors_season_code_key UNIQUE (season, code);
ALTER TABLE drivers      ADD CONSTRAINT drivers_season_code_key      UNIQUE (season, code);
ALTER TABLE grands_prix  ADD CONSTRAINT grands_prix_season_round_key UNIQUE (season, round);
ALTER TABLE sessions     ADD CONSTRAINT sessions_gp_id_type_key      UNIQUE (gp_id, type);
