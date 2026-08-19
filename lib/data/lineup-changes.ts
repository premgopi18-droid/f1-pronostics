// Détection des changements de line-up entre deux GP (#205) — logique PURE,
// même patron que notification-windows : zéro I/O, testable en isolation.
// L'I/O (OpenF1, gp_lineups, push) vit dans lib/data/gp-lineups.ts et le cron.
//
// Les deux maps comparées viennent de la MÊME source (OpenF1 /drivers) : les
// libellés d'écurie sont donc directement comparables, sans normalisation.

export interface LineupChange {
  driverCode: string
  from:       string | null   // null = pilote absent du GP précédent (réserviste, retour)
  to:         string
}

/**
 * Diff du line-up courant contre celui du GP précédent.
 * - Pas de baseline (premier GP suivi, saison qui démarre) → aucun changement :
 *   on sème la référence sans notifier.
 * - Pilote présent des deux côtés avec une écurie différente → changement.
 * - Pilote absent de la baseline (réserviste qui débarque, titulaire de retour
 *   après un forfait) → changement aussi : c'est une info à enjeu pour les pronos.
 * - Pilote présent dans la baseline mais absent du GP courant : ignoré — le
 *   remplaçant porte l'information, et un forfait sec est déjà couvert par la
 *   règle « pilote absent du classement = 0 pt ».
 */
export function diffLineup(
  previous: Map<string, string>,
  current:  Map<string, string>,
): LineupChange[] {
  if (previous.size === 0) return []

  const changes: LineupChange[] = []
  for (const [driverCode, team] of current) {
    const previousTeam = previous.get(driverCode) ?? null
    if (previousTeam === team) continue
    changes.push({ driverCode, from: previousTeam, to: team })
  }
  return changes
}

/**
 * Corps du push agrégé (un seul message par GP, quel que soit le nombre de
 * changements). Les noms affichés sont résolus en amont (nom de famille du
 * pilote) ; l'écurie est le libellé OpenF1 brut.
 */
export function formatLineupChangeBody(
  changes: { displayName: string; teamName: string }[],
): string {
  const parts = changes.map((change, index) =>
    index === 0
      ? `${change.displayName} pilote pour ${change.teamName}`
      : `${change.displayName} pour ${change.teamName}`,
  )
  return `${parts.join(', ')} ce week-end. Vérifie tes pronos et tes items avant le départ !`
}
