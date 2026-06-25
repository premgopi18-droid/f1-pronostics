-- Colonne de tracking pour le rappel push "pronos J-1" (24h avant la 1ère session
-- du week-end qui verrouille pronos + items). Une seule notif par GP : null jusqu'à
-- l'envoi. Au niveau GP (et non session) car l'ancre = la première session-deadline.
ALTER TABLE grands_prix ADD COLUMN IF NOT EXISTS notified_reminder_24h_at TIMESTAMPTZ;
