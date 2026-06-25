-- Colonne de tracking pour le rappel push "tu peux encore ajuster" envoyé 2h après
-- le début d'une session non-finale, pour rappeler que le prono de la session
-- suivante reste modifiable. Une seule notif par session : null jusqu'à l'envoi.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS notified_post_session_at TIMESTAMPTZ;
