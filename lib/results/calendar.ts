export type GpStatus = 'completed' | 'prochain' | 'predictable' | 'upcoming'

export interface GpForStatus {
  scoringFinalizedAt: string | null
  /** ISO UTC du début des qualifications, null si pas encore en base. */
  qualifyingStartsAt: string | null
}

/**
 * Calcule le statut de chaque GP dans la liste ordonnée par round croissant.
 * Pure — sans effet de bord, testable en isolation.
 *
 * Règles :
 * - completed   : scoring_finalized_at est renseigné
 * - prochain    : premier GP non finalisé (hero card)
 * - predictable : non finalisé, pas prochain, quali dans le futur → lien "Pronostiquer"
 * - upcoming    : non finalisé, pas prochain, quali passée ou pas encore en base
 */
export function computeGpStatuses(gps: GpForStatus[], nowMs: number): GpStatus[] {
  let prochainAssigned = false

  return gps.map((gp) => {
    if (gp.scoringFinalizedAt !== null) return 'completed'

    if (!prochainAssigned) {
      prochainAssigned = true
      return 'prochain'
    }

    if (
      gp.qualifyingStartsAt !== null &&
      new Date(gp.qualifyingStartsAt).getTime() > nowMs
    ) {
      return 'predictable'
    }

    return 'upcoming'
  })
}
