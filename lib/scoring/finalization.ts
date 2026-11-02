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
const DAY_MS  = 24 * HOUR_MS

/** Délai minimal entre le DÉPART de la course et la finalisation (décision 02\11\2026). */
export const GP_FINALIZATION_DELAY_MS = 12 * HOUR_MS

/**
 * Jamais de finalisation avant le matin suivant la course, heure de Paris
 * (décision 02\11\2026) : la finalisation envoie les push « résultats
 * définitifs » et « un item a été joué contre toi » — une course européenne
 * finalisée à H+12 les enverrait vers 3 h du matin.
 */
export const FINALIZATION_TIME_ZONE = 'Europe/Paris'
export const FINALIZATION_EARLIEST_LOCAL_HOUR = 8

/**
 * Délai minimal entre la CONFIRMATION de la course (publication Jolpica) et la
 * finalisation : Jolpica publie parfois 10 à 14 h après le départ — sans ce
 * délai, une course confirmée tard serait finalisée dans la foulée, sans
 * jamais avoir été révisée.
 */
export const RACE_CONFIRMATION_REVISION_DELAY_MS = 3 * HOUR_MS

/**
 * La révision s'arrête avant la finalisation : les deux crons tournent sans
 * se coordonner. Une révision qui supprimerait les scores d'une séance pendant
 * que le trigger résout les items finaliserait le GP sans eux. Une heure de
 * marge laisse au trigger au moins deux passages (cadence 10 min le week-end,
 * 30 min en semaine) pour recalculer les scores révisés.
 */
export const RESULTS_REVISION_FREEZE_MS = 1 * HOUR_MS

/** Décalage UTC (ms) du fuseau à l'instant donné. */
function timeZoneOffsetMs(timeZone: string, instant: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(new Date(instant))
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)!.value)
  const wallClockAsUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'))
  return wallClockAsUtc - Math.floor(instant / 1000) * 1000
}

/** Premier instant STRICTEMENT après `instant` où il est `hour`:00 dans le fuseau. */
export function nextLocalHourAfter(instant: number, timeZone: string, hour: number): number {
  const wallClock = new Date(instant + timeZoneOffsetMs(timeZone, instant))
  let candidateWallClock = Date.UTC(wallClock.getUTCFullYear(), wallClock.getUTCMonth(), wallClock.getUTCDate(), hour)
  if (candidateWallClock <= wallClock.getTime()) candidateWallClock += DAY_MS
  // Le décalage du jour visé peut différer (changement d'heure dans la nuit).
  return candidateWallClock - timeZoneOffsetMs(timeZone, candidateWallClock - timeZoneOffsetMs(timeZone, instant))
}

/**
 * Échéance de finalisation : la plus tardive de (départ + 12 h), (lendemain
 * 8 h Paris) et (confirmation de la course + 3 h, si confirmée).
 */
export function finalizationDeadline(raceStartsAt: string, raceConfirmedAt: string | null): number {
  const raceStart = new Date(raceStartsAt).getTime()
  return Math.max(
    raceStart + GP_FINALIZATION_DELAY_MS,
    nextLocalHourAfter(raceStart, FINALIZATION_TIME_ZONE, FINALIZATION_EARLIEST_LOCAL_HOUR),
    raceConfirmedAt ? new Date(raceConfirmedAt).getTime() + RACE_CONFIRMATION_REVISION_DELAY_MS : 0,
  )
}

export function isGPReadyToFinalize(raceStartsAt: string, raceConfirmedAt: string | null, now: number): boolean {
  return raceConfirmedAt !== null && finalizationDeadline(raceStartsAt, raceConfirmedAt) <= now
}

export function isResultsRevisionOpen(raceStartsAt: string, raceConfirmedAt: string | null, now: number): boolean {
  return now < finalizationDeadline(raceStartsAt, raceConfirmedAt) - RESULTS_REVISION_FREEZE_MS
}
