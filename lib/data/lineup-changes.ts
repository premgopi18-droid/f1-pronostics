// Détection des changements de line-up entre deux GP (#205) — logique PURE,
// même patron que notification-windows : zéro I/O, testable en isolation.
// L'I/O (OpenF1, gp_lineups, push) vit dans lib/data/gp-lineups.ts et le cron.
//
// Les deux maps comparées viennent de la MÊME source (OpenF1 /drivers) : les
// libellés d'écurie sont donc directement comparables, sans normalisation.

import type { DbSessionType } from '@/lib/scoring/types'
import type { SessionLineupDriver } from '@/lib/f1/openf1'

export interface LineupChange {
  driverCode: string
  from:       string | null   // null = pilote absent du GP précédent (réserviste, retour)
  to:         string
  /** Pilote remplacé (#255) : seul pilote de l'écurie `to` au GP précédent absent du GP courant. */
  replacedDriverCode: string | null
}

const HOUR_MS = 60 * 60 * 1000

/**
 * Délai PAR TYPE de session après son DÉBUT au bout duquel son /drivers OpenF1
 * est réputé refléter les participants réels (#218) : durée maximale réelle de
 * la séance + latence de bascule OpenF1 (mesurée 30 à 64 min après la fin au
 * GP Pays-Bas 2026, #214). Avant ce délai, le /drivers peut encore être le
 * pré-seed nominal périmé.
 *
 * - Course : jusqu'à ~3 h d'épreuve (drapeaux rouges, limite règlementaire)
 *   → H+4. Un H+3 uniforme pouvait déclarer fiable une course encore en cours.
 * - Autres sessions : durée ≤ ~1 h 30 (qualifs à drapeaux rouges comprises)
 *   → H+2 h 30, valeur conservatrice. Ne PAS descendre sous ce seuil sans
 *   avoir calibré la latence de bascule sur plusieurs GP (warnings #215) :
 *   le tampon observed_at est permanent, la marge doit rester large.
 */
export const LINEUP_SESSION_TRUST_DELAY_MS: Record<DbSessionType, number> = {
  practice_1:        2.5 * HOUR_MS,
  practice_2:        2.5 * HOUR_MS,
  practice_3:        2.5 * HOUR_MS,
  qualifying:        2.5 * HOUR_MS,
  sprint_qualifying: 2.5 * HOUR_MS,
  sprint_race:       2.5 * HOUR_MS,
  race:              4 * HOUR_MS,
}

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
/**
 * true = la session a démarré depuis assez longtemps pour que son /drivers
 * OpenF1 reflète les participants réels (et plus le pré-seed nominal). Sert à
 * distinguer une OBSERVATION fiable du week-end (gp_lineups.observed_at, #211)
 * d'un simple semis de baseline.
 */
export function isLineupSessionTrusted(
  sessionType: DbSessionType,
  sessionStartsAt: string,
  now: number,
): boolean {
  return new Date(sessionStartsAt).getTime() + LINEUP_SESSION_TRUST_DELAY_MS[sessionType] <= now
}

/**
 * true = le line-up de cette session fait foi sur les ENGAGÉS du GP (#255) :
 * session fiable (son /drivers reflète les participants réels) ET pas l'EL1.
 * L'EL1 est la séance des rookies (roulage obligatoire des jeunes pilotes) :
 * un titulaire y est remplacé quelques heures sans être remplacé pour le GP,
 * et le rookie n'a rien à faire dans la liste des pronos. Dès l'EL2, un pilote
 * présent est un engagé du week-end.
 * Effets (lib/data/gp-lineups.ts) : inscription des remplaçants inconnus de
 * `drivers`, et retrait de l'observation des pilotes absents dont le baquet
 * est occupé (cf. isSeatTaken).
 */
export function isLineupSessionAuthoritative(sessionType: DbSessionType, trusted: boolean): boolean {
  return trusted && sessionType !== 'practice_1'
}

/** Baquets par écurie en F1. */
const SEATS_PER_TEAM = 2

/**
 * true = le baquet d'un pilote absent du line-up est occupé : son écurie y
 * compte déjà SEATS_PER_TEAM pilotes. Seule preuve fiable d'un remplacement
 * (#255) — OpenF1 omet parfois un pilote du /drivers d'une session qu'il a
 * courue (Lawson, EL3 Mexique 2026 : absent du /drivers, classé P9 avec 28
 * tours). Une simple absence n'est donc jamais un remplacement : Ocon (Haas :
 * Hirakawa + Bearman présents) l'est, Lawson (Racing Bulls : Lindblad seul) non.
 */
export function isSeatTaken(teamName: string, lineup: ReadonlyMap<string, string>): boolean {
  let teamDrivers = 0
  for (const team of lineup.values()) {
    if (team === teamName) teamDrivers++
  }
  return teamDrivers >= SEATS_PER_TEAM
}

/** Line-up réduit à code pilote → libellé écurie OpenF1 (forme comparée par diffLineup). */
export function lineupTeamByCode(lineup: SessionLineupDriver[]): Map<string, string> {
  return new Map(lineup.map((driver) => [driver.driverCode, driver.teamName]))
}

/**
 * Remplaçants à inscrire dans `drivers` (#255) : pilotes du line-up absents des
 * codes connus de la saison. Cas réel : Hirakawa, GP du Mexique 2026 — Jolpica
 * le listait sans trigramme, il n'arrivait donc jamais par la sync Jolpica.
 * Un pilote sans nom ou sans numéro exploitable n'est pas inscrit : le numéro
 * rattache ses résultats Jolpica sans trigramme, le nom est requis par la table.
 * Un numéro déjà porté par un pilote connu non plus : c'est ce pilote sous un
 * autre trigramme (divergence Jolpica/OpenF1) — l'inscrire créerait un doublon.
 */
export function selectDriversToEnroll(
  lineup: SessionLineupDriver[],
  known: { codes: ReadonlySet<string>; numbers: ReadonlySet<number> },
): SessionLineupDriver[] {
  return lineup.filter((driver) =>
    !known.codes.has(driver.driverCode)
    && !known.numbers.has(driver.driverNumber)
    && Number.isInteger(driver.driverNumber) && driver.driverNumber > 0
    && !!driver.firstName && !!driver.lastName,
  )
}

export function selectLineupSessionCandidates<T extends { type: DbSessionType; startsAt: string }>(
  sessions: T[],
  now: number,
  horizonMs: number,
): T[] {
  const byStartDescending = (a: T, b: T) =>
    new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()

  const trusted = sessions
    .filter((session) => isLineupSessionTrusted(session.type, session.startsAt, now))
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
 * - Pilote remplacé (#255) : si l'écurie d'arrivée avait au GP précédent
 *   exactement UN pilote absent du GP courant, c'est lui que le nouveau venu
 *   remplace (Hirakawa → Ocon). Ambigu (zéro ou plusieurs) → null, le push
 *   retombe sur la formulation sans remplacé. Un échange de baquet n'a pas de
 *   remplacé : les deux pilotes sont toujours en piste.
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
    const departedTeammates = [...previous]
      .filter(([previousCode, previousTeamName]) => previousTeamName === team && !current.has(previousCode))
      .map(([previousCode]) => previousCode)
    changes.push({
      driverCode,
      from: previousTeam,
      to:   team,
      replacedDriverCode: departedTeammates.length === 1 ? departedTeammates[0] : null,
    })
  }
  return changes
}

/**
 * Corps du push agrégé (un seul message par GP, quel que soit le nombre de
 * changements). Les noms affichés sont résolus en amont (nom de famille du
 * pilote) ; l'écurie est le libellé OpenF1 brut.
 */
export function formatLineupChangeBody(
  changes: { displayName: string; teamName: string; replacedDisplayName?: string | null }[],
): string {
  const parts = changes.map((change, index) => {
    if (change.replacedDisplayName) {
      return `${change.displayName} remplace ${change.replacedDisplayName} chez ${change.teamName}`
    }
    return index === 0
      ? `${change.displayName} pilote pour ${change.teamName}`
      : `${change.displayName} pour ${change.teamName}`
  })
  return `${parts.join(', ')} ce week-end. Vérifie tes pronos et tes items avant le départ !`
}
