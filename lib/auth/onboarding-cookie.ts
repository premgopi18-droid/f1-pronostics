/**
 * Cookie « onboarding terminé » lu par le proxy (#243). Sans lui, chaque navigation
 * coûte une lecture `profiles.onboarding_completed` en série après la validation
 * du JWT (≈ 40 ms). Le proxy pose ce cookie la première fois qu'il constate le
 * profil finalisé, puis saute la lecture tant que le cookie désigne l'utilisateur
 * courant. Module sans dépendance : importé par le proxy (middleware).
 *
 * Sécurité : le cookie ne court-circuite que l'état « terminé », qui ne revient
 * jamais en arrière (un compte supprimé n'a plus de session). Un utilisateur qui
 * le forgerait ne sauterait que SON propre onboarding — sans gain.
 */
export const ONBOARDED_COOKIE = 'bx_onboarded'

/** Durée de vie (30 jours) : le proxy le repose de toute façon à chaque relecture DB. */
export const ONBOARDED_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

/**
 * Le cookie vaut-il pour cet utilisateur ? Sa valeur est l'id du compte finalisé :
 * une reconnexion avec un autre compte sur le même navigateur force la relecture.
 */
export function isOnboardedCookieValid(cookieValue: string | undefined, userId: string): boolean {
  return cookieValue !== undefined && cookieValue.length > 0 && cookieValue === userId
}
