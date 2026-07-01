// Logique PURE de disponibilité des items GP (sans I/O, testée en isolation).
// Répond à deux questions : « jusqu'à quand un item est-il jouable ? » (paliers +
// gating par session) et « pourquoi un item est-il indisponible ? » (états grisés UI).
// Voir product-specs §3.5 et l'issue de refonte des fenêtres de jeu des items.

import { SCOREABLE_SESSION_TYPES, type SessionType } from '@/lib/scoring/types'
import type { ItemLockPhase } from './catalog'

const SCOREABLE = new Set<string>(SCOREABLE_SESSION_TYPES)
const RACE_SESSION: SessionType = 'race'

/** Session scorée du GP réduite à ce dont dépend la disponibilité. */
export type SessionTiming = { type: SessionType; startsAt: string }

/**
 * Deadline dure d'un item selon son palier :
 * - `pre_qualifying` → début de la 1ʳᵉ session scorée (Q1, ou Sprint Qualifying) ;
 * - `pre_race`       → départ de la course principale (`race`), JAMAIS la sprint race.
 * `null` si l'info manque (aucune session scorée / pas de course) → traité comme non verrouillé.
 */
export function itemDeadline(
  phase: ItemLockPhase,
  sessions: readonly SessionTiming[],
): Date | null {
  const scored = sessions.filter((s) => SCOREABLE.has(s.type))
  if (scored.length === 0) return null

  if (phase === 'pre_qualifying') {
    const earliest = scored.reduce((min, s) =>
      new Date(s.startsAt).getTime() < new Date(min.startsAt).getTime() ? s : min,
    )
    return new Date(earliest.startsAt)
  }

  const race = scored.find((s) => s.type === RACE_SESSION)
  return race ? new Date(race.startsAt) : null
}

/** `true` si la deadline dure du palier est atteinte (item verrouillé pour ce GP). */
export function isPhaseLocked(
  phase: ItemLockPhase,
  sessions: readonly SessionTiming[],
  nowMs: number,
): boolean {
  const deadline = itemDeadline(phase, sessions)
  return deadline !== null && nowMs >= deadline.getTime()
}

/**
 * Sessions réellement sélectionnables pour un item à session :
 * autorisées pour l'item ∩ pas encore démarrées. Une session déjà courue disparaît
 * du menu même si la deadline dure de l'item n'est pas atteinte (cf. Bloquer un pilote).
 */
export function selectableSessions(
  allowed: ReadonlySet<string>,
  sessions: readonly SessionTiming[],
  nowMs: number,
): SessionType[] {
  return sessions
    .filter((s) => allowed.has(s.type) && new Date(s.startsAt).getTime() > nowMs)
    .map((s) => s.type)
}

/**
 * Jouabilité d'un GP pour les items, relative au GP courant (le premier GP non
 * finalisé). Seul le GP courant est `open` ; les suivants sont `future`, les
 * précédents (ou fin de saison) `past`.
 */
export type GpPlayability = 'open' | 'future' | 'past'

export function gpPlayability(
  thisRound: number,
  currentGpRound: number | null,
): GpPlayability {
  if (currentGpRound === null) return 'past'
  if (thisRound > currentGpRound) return 'future'
  if (thisRound < currentGpRound) return 'past'
  return 'open'
}

/**
 * Disponibilité d'un item DONNÉ sur le GP courant (page « ouverte »). Renvoie le
 * motif d'indisponibilité le plus prioritaire pour le grisage UI :
 * slot hebdo pris > stock épuisé > deadline de palier passée.
 */
export type ItemUnavailableReason = 'weekly_slot_taken' | 'exhausted' | 'phase_locked'

export type ItemAvailability =
  | { available: true }
  | { available: false; reason: ItemUnavailableReason }

export function itemAvailability(params: {
  phase:                ItemLockPhase
  sessions:             readonly SessionTiming[]
  nowMs:                number
  hasPlayedThisWeekend: boolean
  usesRemaining:        number
}): ItemAvailability {
  if (params.hasPlayedThisWeekend) return { available: false, reason: 'weekly_slot_taken' }
  if (params.usesRemaining <= 0)   return { available: false, reason: 'exhausted' }
  if (isPhaseLocked(params.phase, params.sessions, params.nowMs)) {
    return { available: false, reason: 'phase_locked' }
  }
  return { available: true }
}
