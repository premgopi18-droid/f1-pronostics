-- Schéma requis par les notifications Web Push (PR #15)
-- Idempotent : ces objets ont pu être appliqués en amont sur le projet distant.

-- Idempotence des envois : une seule notif par GP même si le cron tourne plusieurs fois.
ALTER TABLE grands_prix ADD COLUMN IF NOT EXISTS notified_open_at   TIMESTAMPTZ;
ALTER TABLE grands_prix ADD COLUMN IF NOT EXISTS notified_scores_at TIMESTAMPTZ;

-- Requise par l'upsert ON CONFLICT (endpoint) de subscribeAction.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_endpoint_key'
  ) THEN
    ALTER TABLE push_subscriptions
      ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);
  END IF;
END $$;
