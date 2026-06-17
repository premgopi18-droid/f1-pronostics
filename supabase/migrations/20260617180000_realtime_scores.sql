-- Active Supabase Realtime sur la table scores pour le classement temps réel.
-- Les clients authentifiés s'abonnent aux changements filtrés par league_id ;
-- le RLS de la table scores s'applique — seuls les membres de la ligue reçoivent les events.
ALTER PUBLICATION supabase_realtime ADD TABLE scores;
