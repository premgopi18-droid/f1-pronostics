export type GpStatus = 'completed' | 'prochain' | 'predictable' | 'upcoming'

export interface GpForStatus {
  /**
   * ISO UTC de confirmation des résultats officiels de la course (Jolpica), null tant
   * qu'ils ne sont pas en base. Signal de disponibilité des résultats officiels du GP —
   * indépendant de la finalisation du scoring de ligue (`scoring_finalized_at`).
   */
  raceResultsConfirmedAt: string | null
  /** ISO UTC du début des qualifications, null si pas encore en base. */
  qualifyingStartsAt: string | null
}

/**
 * Calcule le statut de chaque GP dans la liste ordonnée par round croissant.
 * Pure — sans effet de bord, testable en isolation.
 *
 * Règles :
 * - completed   : résultats officiels de la course confirmés en base
 * - prochain    : premier GP sans résultats officiels (hero card)
 * - predictable : pas de résultats, pas prochain, quali dans le futur → lien "Pronostiquer"
 * - upcoming    : pas de résultats, pas prochain, quali passée ou pas encore en base
 */
export function computeGpStatuses(gps: GpForStatus[], nowMs: number): GpStatus[] {
  let prochainAssigned = false

  return gps.map((gp) => {
    if (gp.raceResultsConfirmedAt !== null) return 'completed'

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
