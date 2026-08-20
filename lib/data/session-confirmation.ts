import { PRACTICE_SESSION_TYPES } from '@/lib/scoring/types'
import type { DbSessionType } from '@/lib/scoring/types'

// Décision de report de la confirmation des résultats d'une session (#212) —
// logique PURE, même patron que lineup-changes : zéro I/O, testable en isolation.
//
// Contexte : upsertSessionResults écarte les pilotes du résultat absents de
// `drivers` (remplaçant qu'OpenF1 connaît mais que Jolpica n'a pas encore
// listé), et une session confirmée n'est plus jamais revisitée par le cron —
// confirmer dans cet état perdrait ces lignes définitivement.
//
// Le report ne concerne QUE les essais libres (informatifs, non scorés). Les
// sessions scorées se confirment immédiatement : leur confirmation déclenche le
// scoring et la grille de pré-remplissage, et un pilote filtré y est forcément
// non pronostiquable (être dans `drivers` est requis par la validation des
// pronos) — aucun point ne peut donc être faussé par une ligne écartée.
//
// Cas récurrent assumé (review #213) : les rookies des EL1 roulent avec un
// trigramme OpenF1 mais sont listés SANS code par Jolpica (9 pilotes en 2026)
// — ils n'arriveront jamais dans `drivers`, et chaque EL avec un run rookie
// reste donc « provisoire » jusqu'à la borne avant de se confirmer. Coût :
// re-fetchs OpenF1 + un warning par passage, aucun impact points. Assumé plutôt
// qu'une borne courte : la borne large couvre aussi une indisponibilité Jolpica
// d'une journée pour le vrai cas cible (le remplaçant type Tsunoda).

/**
 * Au-delà de cette fenêtre après le début de la session, on confirme malgré les
 * pilotes manquants : un pilote toujours inconnu de Jolpica 24 h après avoir
 * roulé est un réserviste sans trigramme officiel — il n'arrivera plus.
 */
export const UNKNOWN_DRIVER_CONFIRMATION_GRACE_MS = 24 * 60 * 60 * 1000

/**
 * true = ne pas confirmer la session à ce passage : des lignes du résultat ont
 * été écartées et peuvent encore être rattrapées au passage suivant (la phase
 * pilotes du cron tourne avant la phase résultats).
 *
 * Garde-fou absolu (review #213) : si TOUTES les lignes ont été écartées, on ne
 * confirme jamais — quel que soit le type de session et même après la fenêtre
 * de grâce. Confirmer une session vide déclencherait un scoring sur des
 * résultats inexistants (tout le monde à 0) ; rester « provisoire » est
 * toujours préférable à cet état.
 */
export function shouldDeferSessionConfirmation(
  unknownDriverCodes: string[],
  resultCount: number,
  sessionType: DbSessionType,
  sessionStartsAt: string,
  now: number,
): boolean {
  if (unknownDriverCodes.length === 0) return false
  if (unknownDriverCodes.length >= resultCount) return true
  if (!PRACTICE_SESSION_TYPES.includes(sessionType)) return false
  return now - new Date(sessionStartsAt).getTime() < UNKNOWN_DRIVER_CONFIRMATION_GRACE_MS
}
