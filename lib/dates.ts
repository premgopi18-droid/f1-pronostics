/**
 * Formatage date/heure d'affichage — fuseau épinglé Europe/Paris (#221).
 *
 * Règle transverse : le rendu serveur tourne en UTC sur Vercel. Tout formatage
 * qui omet `timeZone` affiche l'heure UTC (voire le mauvais jour autour de
 * minuit) en prod, silencieusement. Passer par ce module — jamais par un
 * `toLocaleDateString`/`Intl.DateTimeFormat` direct dans les pages.
 */

export const PARIS_TIME_ZONE = 'Europe/Paris'
const DISPLAY_LOCALE = 'fr-FR'

/** Formatage générique épinglé fr-FR + Europe/Paris. */
export function formatParis(
  date: Date | string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    ...options,
    timeZone: PARIS_TIME_ZONE,
  }).format(typeof date === 'string' ? new Date(date) : date)
}

/** « ven. 16:30 » — deadlines et horaires de session. */
export function formatParisWeekdayTime(date: Date | string): string {
  return formatParis(date, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}

/** « ven. » — jour abrégé seul (colonnes étroites). */
export function formatParisWeekday(date: Date | string): string {
  return formatParis(date, { weekday: 'short' })
}
