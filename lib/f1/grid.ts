import type { SessionType } from '@/lib/scoring/types'

// ── Grille de départ — mapping course → session productrice ────────────────
// La grille d'une session course est produite par la session qualificative du
// même week-end : qualifications → course, sprint qualifying → sprint race.
// Partagé entre le cron de sync (import OpenF1) et la page pronostic
// (fallback sur le classement de la session source) pour qu'un changement de
// format ne se corrige qu'à un seul endroit.

export type GridTargetSessionType = 'race' | 'sprint_race'

export const GRID_SOURCE_SESSION_TYPE: Record<GridTargetSessionType, SessionType> = {
  race:        'qualifying',
  sprint_race: 'sprint_qualifying',
}

/** Session source de la grille pour un type de session, null si le type n'est
 *  pas une session course. */
export function gridSourceSessionType(type: SessionType): SessionType | null {
  return type === 'race' || type === 'sprint_race' ? GRID_SOURCE_SESSION_TYPE[type] : null
}
