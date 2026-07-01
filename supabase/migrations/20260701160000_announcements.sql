-- Canal d'annonces produit (« Nouveautés ») — #168
-- · table `announcements`         → source de vérité éditoriale + dédup d'envoi (sent_at)
-- · profiles.notif_announcements  → opt-in dédié (défaut true, opt-out par l'utilisateur)
-- Idempotent : réappliquer ne casse rien.

CREATE TABLE IF NOT EXISTS announcements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  url        TEXT NOT NULL DEFAULT '/whats-new',
  -- Clé d'idempotence optionnelle : un envoi rejoué avec la même `dedup_key` retombe
  -- sur la même ligne au lieu de créer un doublon (retry réseau du curl admin).
  dedup_key  TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Renseigné au moment de la diffusion : NULL = brouillon jamais poussé.
  sent_at    TIMESTAMPTZ
);

-- /whats-new liste les annonces déjà diffusées, les plus récentes d'abord.
CREATE INDEX IF NOT EXISTS announcements_sent_at_idx ON announcements (sent_at DESC);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Lecture : tout utilisateur authentifié voit les annonces DÉJÀ diffusées (sent_at non null).
-- Écriture : aucune policy → réservée au service-role (endpoint admin), qui bypasse le RLS.
DROP POLICY IF EXISTS announcements_select_sent ON announcements;
CREATE POLICY announcements_select_sent ON announcements
  FOR SELECT TO authenticated
  USING (sent_at IS NOT NULL);

-- Opt-in annonces produit — INDÉPENDANT de notif_imminence_scope. Défaut true : tout le
-- monde reçoit les nouveautés sauf opt-out explicite (cohérent avec « toutes activées par défaut »).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notif_announcements BOOLEAN NOT NULL DEFAULT true;
