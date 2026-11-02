// Révision du classement d'une séance scorée déjà confirmée (#259) — logique
// PURE, zéro I/O. L'I/O (OpenF1, RPC apply_session_revision, push) vit dans le
// cron de sync.
//
// Source de révision : OpenF1 /session_result (chronométrage officiel). Au GP
// du Mexique 2026, il portait les pénalités de course et la disqualification de
// Lawson en qualifs, alors que Jolpica (source de la confirmation initiale)
// ne les avait toujours pas 24 h après. Rejoué sur 51 séances 2026 : identique
// à Jolpica partout ailleurs.

export type ClassificationEntry = {
  driverCode:    string
  /** null : pas de position officielle (abandon, disqualifié, non classé). */
  position:      number | null
  /** Disqualifié selon la source (OpenF1 `dsq`) — classé après les abandons. */
  disqualified?: boolean
}

export type RevisionOutcome =
  | { kind: 'unchanged' }
  | { kind: 'unusable'; reason: string }
  | { kind: 'revised'; positions: Map<string, number> }

/**
 * Compare le classement stocké au classement officiel.
 *
 * - Pilote classé côté officiel : sa position officielle, reprise telle quelle
 *   (sans renumérotation : un classé que nous ne connaissons pas garde sa
 *   place, les autres ne remontent pas à tort).
 * - Pilote sans position officielle : derrière TOUS les classés — d'abord les
 *   abandons dans l'ordre stocké (Jolpica les classe au nombre de tours), puis
 *   les disqualifiés (règle specs : disqualifié = dernier de la séance). Le
 *   drapeau `dsq` d'OpenF1 n'est pas toujours posé (Lawson, qualifs du
 *   Mexique : position null, dsq false) — il reste alors à sa place stockée.
 * - Inexploitable (`unusable`, on ne touche à rien) : classement vide, position
 *   en double, ou pilote stocké absent du classement officiel (publication
 *   partielle — fréquent en sprint qualif) : réviser sur une donnée
 *   incomplète fausserait des scores.
 */
export function computeRevisedPositions(
  stored:   ClassificationEntry[],
  official: ClassificationEntry[],
): RevisionOutcome {
  if (official.length === 0) return { kind: 'unusable', reason: 'classement officiel vide' }

  const officialPositions = official.flatMap((entry) => entry.position !== null ? [entry.position] : [])
  if (new Set(officialPositions).size !== officialPositions.length) {
    return { kind: 'unusable', reason: 'position officielle en double' }
  }

  const officialByCode = new Map(official.map((entry) => [entry.driverCode, entry]))
  const missing = stored.filter((entry) => !officialByCode.has(entry.driverCode)).map((entry) => entry.driverCode)
  if (missing.length > 0) {
    return { kind: 'unusable', reason: `absents du classement officiel : ${missing.join(', ')}` }
  }

  const byStoredPosition = (a: ClassificationEntry, b: ClassificationEntry) =>
    (a.position ?? Infinity) - (b.position ?? Infinity)
  const unclassified = stored.filter((entry) => officialByCode.get(entry.driverCode)!.position === null)
  const unclassifiedOrder = [
    ...unclassified.filter((entry) => !officialByCode.get(entry.driverCode)!.disqualified).sort(byStoredPosition),
    ...unclassified.filter((entry) => officialByCode.get(entry.driverCode)!.disqualified).sort(byStoredPosition),
  ]

  const lastClassifiedPosition = Math.max(0, ...officialPositions)
  const revised = new Map<string, number>()
  for (const entry of stored) {
    const officialPosition = officialByCode.get(entry.driverCode)!.position
    if (officialPosition !== null) revised.set(entry.driverCode, officialPosition)
  }
  unclassifiedOrder.forEach((entry, index) => revised.set(entry.driverCode, lastClassifiedPosition + index + 1))

  const changes = new Map<string, number>()
  for (const entry of stored) {
    const position = revised.get(entry.driverCode)!
    if (position !== entry.position) changes.set(entry.driverCode, position)
  }
  return changes.size > 0 ? { kind: 'revised', positions: changes } : { kind: 'unchanged' }
}
