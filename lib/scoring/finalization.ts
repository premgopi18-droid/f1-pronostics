// Calendrier de finalisation d'un GP et fenêtre de révision des classements
// (#259) — logique PURE, zéro I/O.
//
// Les commissaires sanctionnent souvent APRÈS l'arrivée : pénalités en temps,
// disqualifications, parfois dans la nuit (GP du Mexique 2026 : Piastri,
// Colapinto, Gasly pénalisés après la course, Lawson disqualifié des qualifs
// après la séance). La finalisation (items résolus, scores définitifs) attend
// donc ces décisions, et les classements des séances scorées restent
// révisables jusque-là.

const HOUR_MS = 60 * 60 * 1000

/**
 * Délai entre le DÉPART de la course et la finalisation du GP (décision
 * 02\11\2026) : couvre les décisions de nuit observées au Mexique pour une
 * course du dimanche soir — définitifs le lendemain matin.
 */
export const GP_FINALIZATION_DELAY_MS = 12 * HOUR_MS

/**
 * La révision s'arrête avant la finalisation : les deux crons tournent toutes
 * les 10 min et ne se coordonnent pas. Une révision qui supprimerait les scores
 * d'une séance pendant que le trigger résout les items finaliserait le GP sans
 * eux (perte silencieuse). Une heure de marge = 6 passages : les scores
 * révisés sont recalculés avant que la finalisation ne devienne possible.
 */
export const RESULTS_REVISION_FREEZE_MS = 1 * HOUR_MS

export function isGPReadyToFinalize(raceStartsAt: string, now: number): boolean {
  return new Date(raceStartsAt).getTime() + GP_FINALIZATION_DELAY_MS <= now
}

export function isResultsRevisionOpen(raceStartsAt: string, now: number): boolean {
  return now < new Date(raceStartsAt).getTime() + GP_FINALIZATION_DELAY_MS - RESULTS_REVISION_FREEZE_MS
}
