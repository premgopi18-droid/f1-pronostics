-- Colonnes de tracking pour les notifications liées aux sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS notified_deadline_at    TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS notified_provisional_at TIMESTAMPTZ;
