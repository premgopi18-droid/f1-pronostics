import { sessionLockState } from '@/lib/home-phase'
import type { SessionType } from '@/lib/scoring/types'

/**
 * État d'une pastille du bloc « Qui est prêt ? » (product-specs §7) :
 * - submitted : prono valide soumis pour la session
 * - missing   : pas de prono et la session n'a pas commencé — encore temps
 * - missed    : session verrouillée sans prono — trop tard
 */
export type ReadinessLightState = 'submitted' | 'missing' | 'missed'

export type ReadinessSession = {
  id: string
  type: SessionType
  startsAt: string
}

export type ReadinessMember = {
  userId: string
  pseudo: string
  avatarKey: string | null
  avatarUrl: string | null
}

export type ReadinessRow = {
  member: ReadinessMember
  /** Une pastille par session, dans l'ordre de `sessions`. */
  lights: ReadinessLightState[]
}

export function readinessLightState(
  nowMs: number,
  startsAt: string,
  hasSubmitted: boolean,
): ReadinessLightState {
  if (hasSubmitted) return 'submitted'
  return sessionLockState(nowMs, startsAt) === 'locked' ? 'missed' : 'missing'
}

/**
 * Construit la grille membres × sessions du bloc « Qui est prêt ? ».
 * `submittedBySession` : session id → ids des membres ayant un prono valide.
 * Ne transporte que des booléens de soumission — jamais le contenu des pronos.
 */
export function buildReadinessRows(
  members: ReadinessMember[],
  sessions: ReadinessSession[],
  submittedBySession: ReadonlyMap<string, ReadonlySet<string>>,
  nowMs: number,
): ReadinessRow[] {
  return members.map((member) => ({
    member,
    lights: sessions.map((session) =>
      readinessLightState(
        nowMs,
        session.startsAt,
        submittedBySession.get(session.id)?.has(member.userId) ?? false,
      ),
    ),
  }))
}
