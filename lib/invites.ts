/**
 * Cookie portant le code d'invitation en attente pendant le parcours invité
 * (clic sur lien → login → onboarding → auto-join). Module volontairement sans
 * dépendance lourde : il est importé par le proxy (middleware).
 */
export const PENDING_INVITE_COOKIE = 'pending_invite'

/** Durée de vie du cookie (30 min) — le temps de finir login + onboarding. */
export const PENDING_INVITE_MAX_AGE = 60 * 30

/**
 * Format d'un code d'invitation : 8 caractères hexadécimaux (cf. `create_league`,
 * `upper(substr(md5/uuid, 1, 8))`). Sert à ne pas persister une valeur arbitraire
 * dans le cookie côté proxy. Insensible à la casse (le code est normalisé à la
 * consommation).
 */
export const INVITE_CODE_PATTERN = /^[0-9A-Fa-f]{8}$/
