-- Active Supabase Realtime sur la table scores pour le classement temps réel.
-- Les clients authentifiés s'abonnent aux changements filtrés par league_id ;
-- le RLS de la table scores s'applique — seuls les membres de la ligue reçoivent les events.
-- Idempotent : Postgres n'a pas de `ADD TABLE IF NOT EXISTS` pour les publications.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'scores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE scores;
  END IF;
END $$;
