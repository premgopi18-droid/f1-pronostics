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
 * Délai après le DÉBUT d'une session au bout duquel son /drivers OpenF1 est
 * réputé refléter les participants réels : durée maximale de séance (~2 h pour
 * une course) + ~1 h de latence de mise à jour constatée après la fin (#214).
 * Avant ce délai, le /drivers peut encore être le pré-seed nominal périmé.
 */
export const LINEUP_SESSION_TRUST_DELAY_MS = 3 * 60 * 60 * 1000

/**
 * Sessions candidates à l'interrogation OpenF1. OpenF1 PRÉ-SEEDE les /drivers
 * de toutes les sessions du meeting avec le line-up nominal (constaté dès le
 * jeudi) et ne les met à jour qu'au passage réel de la séance, ~1 h après sa
 * FIN (#214, GP Pays-Bas 2026) — une session future OU fraîchement démarrée
 * porte donc une donnée suspecte de péremption, qui ne doit jamais écraser
 * celle d'une session réellement courue.
 *
 * Trois niveaux de confiance :
 * 1. Sessions FIABLES (démarrées depuis plus de LINEUP_SESSION_TRUST_DELAY_MS),
 *    de la plus récente à la plus ancienne — s'il en existe, elles seules sont
 *    consultées : rien ne peut re-écraser leur vérité.
 * 2. Sinon, sessions démarrées pas encore fiables — leur /drivers peut avoir
 *    déjà basculé, jamais pire que le pré-seed d'une session future.
 * 3. Sinon (jeudi, vendredi avant EL1) : pré-seed des sessions à venir dans
 *    l'horizon, de la plus proche à la plus lointaine — semis de baseline.
 *
 * Limite connue : un remplacement de dernière minute le dimanche matin n'est
 * répercuté par OpenF1 qu'après le départ de la course — indétectable avant,
 * aucune donnée OpenF1 pré-course ne portant l'écurie.
 */
export function selectLineupSessionCandidates<T extends { startsAt: string }>(
  sessions: T[],
  now: number,
  horizonMs: number,
): T[] {
  const byStartDescending = (a: T, b: T) =>
    new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()

  const trusted = sessions
    .filter((session) => new Date(session.startsAt).getTime() + LINEUP_SESSION_TRUST_DELAY_MS <= now)
    .sort(byStartDescending)
  if (trusted.length > 0) return trusted

  const started = sessions
    .filter((session) => new Date(session.startsAt).getTime() <= now)
    .sort(byStartDescending)
  if (started.length > 0) return started

  return sessions
    .filter((session) => {
      const startsAt = new Date(session.startsAt).getTime()
      return startsAt > now && startsAt <= now + horizonMs
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
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
 *
 * Limitation connue : si OpenF1 renomme un libellé d'écurie en cours de saison
 * (« RB » → « Racing Bulls »), les pilotes de l'écurie déclenchent une fausse
 * notification unique au GP suivant, auto-résorbée dès que la baseline porte
 * le nouveau libellé. Rare et bénin — assumé.
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
