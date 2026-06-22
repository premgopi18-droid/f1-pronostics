/**
 * Cookie portant le code d'invitation en attente pendant le parcours invité
 * (clic sur lien → login → onboarding → auto-join). Module volontairement sans
 * dépendance lourde : il est importé par le proxy (middleware).
 */
export const PENDING_INVITE_COOKIE = "pending_invite";

/** Durée de vie du cookie (30 min) — le temps de finir login + onboarding. */
export const PENDING_INVITE_MAX_AGE = 60 * 30;
