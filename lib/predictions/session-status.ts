import { sessionLockState, type SessionLockState } from '@/lib/home-phase'
import type { SessionType } from '@/lib/scoring/types'

/**
 * Sessions pronosticables d'un GP avec verrouillage et soumission de l'utilisateur
 * (bloc « GP en cours » de l'onglet Mes Pronos). Dérivation pure : les sessions
 * viennent du calendrier saison déjà chargé et les soumissions d'une requête
 * indépendante — plus d'aller-retour dépendant du GP courant (#243).
 */

export type ScoreableSession = {
  id: string
  type: SessionType
  startsAt: string
}

export type GpSessionView = {
  type: SessionType
  lockState: SessionLockState
  hasSubmitted: boolean
  startsAt: string
}

/**
 * @param sessions sessions pronosticables du GP, dans l'ordre chronologique
 * @param submittedSessionIds ids de sessions où l'utilisateur a un prono valide
 */
export function deriveGpSessionStatuses(
  sessions: ReadonlyArray<ScoreableSession>,
  submittedSessionIds: ReadonlySet<string>,
  nowMs: number,
): GpSessionView[] {
  return sessions.map((session) => ({
    type: session.type,
    lockState: sessionLockState(nowMs, session.startsAt),
    hasSubmitted: submittedSessionIds.has(session.id),
    startsAt: session.startsAt,
  }))
}
