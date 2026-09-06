import { PRACTICE_SESSION_TYPES } from '@/lib/scoring/types'
import type { DbSessionType, DriverResult } from '@/lib/scoring/types'

// Décision de report de la confirmation des résultats d'une session — logique
// PURE, même patron que lineup-changes : zéro I/O, testable en isolation.
//
// Une session confirmée n'est plus jamais revisitée par le cron, et le scoring
// finalise le GP quelques minutes après : tout ce qui manque au moment de la
// confirmation est perdu définitivement. Deux cas de résultat incomplet :
//
// 1. Pilotes inconnus (#212) : upsertSessionResults écarte les pilotes du
//    résultat absents de `drivers` (remplaçant qu'OpenF1 connaît mais que
//    Jolpica n'a pas encore listé). Report réservé aux essais libres
//    (informatifs, non scorés) : sur une session scorée, un pilote filtré est
//    forcément non pronostiquable (être dans `drivers` est requis par la
//    validation des pronos) — aucun point ne peut donc être faussé.
//    Cas récurrent assumé (review #213) : les rookies des EL1 roulent avec un
//    trigramme OpenF1 mais sont listés SANS code par Jolpica (9 pilotes en 2026)
//    — ils n'arriveront jamais dans `drivers`, et chaque EL avec un run rookie
//    reste donc « provisoire » jusqu'à la borne avant de se confirmer. Coût :
//    re-fetchs OpenF1 + un warning par passage, aucun impact points.
//
// 2. Meilleur tour absent sur une course (#239) : Jolpica publie parfois le
//    classement AVANT le bloc FastestLap (Monza 2026 : toujours absent 6 h
//    après l'arrivée). Une course terminée a forcément un meilleur tour — un
//    résultat sans aucun `fastestLap: true` est une publication partielle, pas
//    une information. Confirmer dans cet état perd le bonus +7 pour tout le
//    monde, et un rattrapage après coup n'est pas possible proprement : Wild
//    Card (moitié du score) et Double points (×2) dépendent du score de base,
//    bonus inclus. Le fallback OpenF1 (fetchRaceFastestLapDriver) couvre le cas
//    courant ; ce report n'est que le filet si les deux sources sont en retard.

/**
 * Pilotes inconnus (#212) : au-delà de cette fenêtre après le début de la
 * session, on confirme malgré les pilotes manquants — un pilote toujours
 * inconnu de Jolpica 24 h après avoir roulé est un réserviste sans trigramme
 * officiel, il n'arrivera plus. Large sans coût : différer un EL ne retient
 * aucun score.
 */
export const UNKNOWN_DRIVER_CONFIRMATION_GRACE_MS = 24 * 60 * 60 * 1000

/**
 * Meilleur tour absent (#239) : fenêtre volontairement plus courte que #212,
 * car différer la course retient TOUTES les positions (~70 pts) pour un bonus
 * de 7. Le cas ne joue que si Jolpica ET OpenF1 manquent le meilleur tour ; les
 * pannes OpenF1 connues sont courtes (pré-seed /drivers périmé ~1 h — #215,
 * indisponibilité passagère) et le cron repasse toutes les 10 min le week-end.
 * 6 h après le départ ≈ 4 h après l'arrivée ≈ 24 tentatives : au-delà, on
 * confirme sans bonus (erreur loguée, rattrapage manuel) plutôt que de
 * repousser les scores provisoires au lendemain.
 */
export const RACE_FASTEST_LAP_GRACE_MS = 6 * 60 * 60 * 1000

/** true si au moins un pilote du résultat porte le meilleur tour. */
export function hasFastestLap(results: Map<string, DriverResult>): boolean {
  for (const result of results.values()) {
    if (result.fastestLap) return true
  }
  return false
}

/**
 * Pose le meilleur tour sur `driverCode` (fallback OpenF1, #239). Renvoie false
 * — sans rien modifier — si le pilote est absent du résultat : désaccord entre
 * les deux sources (trigramme différent, pilote écarté côté Jolpica) que
 * l'appelant doit rendre visible, car il ne se résoudra pas en réessayant.
 */
export function markFastestLap(results: Map<string, DriverResult>, driverCode: string): boolean {
  const result = results.get(driverCode)
  if (!result) return false
  result.fastestLap = true
  return true
}

export type SessionConfirmationInput = {
  unknownDriverCodes: string[]
  resultCount:        number
  sessionType:        DbSessionType
  sessionStartsAt:    string
  /** Meilleur tour connu (Jolpica ou fallback OpenF1) — sans objet hors course. */
  fastestLapKnown:    boolean
  now:                number
}

/**
 * true = ne pas confirmer la session à ce passage : le résultat est incomplet
 * et peut encore être complété au passage suivant.
 *
 * Garde-fou absolu (review #213) : si TOUTES les lignes ont été écartées, on ne
 * confirme jamais — quel que soit le type de session et même après la fenêtre
 * de grâce. Confirmer une session vide déclencherait un scoring sur des
 * résultats inexistants (tout le monde à 0) ; rester « provisoire » est
 * toujours préférable à cet état.
 */
export function shouldDeferSessionConfirmation(input: SessionConfirmationInput): boolean {
  const { unknownDriverCodes, resultCount, sessionType, sessionStartsAt, fastestLapKnown, now } = input

  if (unknownDriverCodes.length > 0 && unknownDriverCodes.length >= resultCount) return true

  const elapsedSinceStart = now - new Date(sessionStartsAt).getTime()

  if (sessionType === 'race' && !fastestLapKnown) {
    return elapsedSinceStart < RACE_FASTEST_LAP_GRACE_MS
  }

  if (unknownDriverCodes.length === 0) return false
  if (!PRACTICE_SESSION_TYPES.includes(sessionType)) return false
  return elapsedSinceStart < UNKNOWN_DRIVER_CONFIRMATION_GRACE_MS
}
