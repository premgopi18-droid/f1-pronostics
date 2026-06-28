-- Notif "session imminente" (#118) :
-- · sessions.notified_imminence_at   → dédup atomique (claim avant push)
-- · profiles.notif_imminence_scope   → préférence utilisateur (toutes / enjeu / aucune)

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS notified_imminence_at TIMESTAMPTZ;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notif_imminence_scope TEXT NOT NULL DEFAULT 'stakes-only'
  CHECK (notif_imminence_scope IN ('all', 'stakes-only', 'none'));
