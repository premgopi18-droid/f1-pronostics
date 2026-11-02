// Révision du classement d'une séance scorée déjà confirmée (#259) — logique
// PURE, zéro I/O. L'I/O (OpenF1, RPC apply_session_revision, push) vit dans le
// cron de sync.
//
// Source de révision : OpenF1 /session_result (chronométrage officiel). Au GP
// du Mexique 2026, il portait les pénalités de course et la disqualification de
// Lawson en qualifs, alors que Jolpica (source de la confirmation initiale)
// ne les avait toujours pas 24 h après.

export type ClassificationEntry = {
  driverCode: string
  /** null : pas de position officielle (abandon, disqualifié, non classé). */
  position:   number | null
}

/**
 * Nouvelles positions des pilotes dont le classement a changé, ou null si rien
 * à réviser (classement identique, ou classement officiel inexploitable).
 *
 * - Pilote classé côté officiel : sa position officielle.
 * - Pilote sans position officielle (abandon, disqualifié) : derrière TOUS les
 *   classés, dans l'ordre stocké — un disqualifié est classé dernier de la
 *   séance (règle specs, décision 01\11\2026), les abandons gardent leur ordre
 *   (Jolpica les classe au nombre de tours).
 * - Garde-fous (null = on ne touche à rien) : classement officiel vide, position
 *   officielle en double, ou pilote stocké absent du classement officiel
 *   (publication partielle, numéro inattribuable) — réviser sur une donnée
 *   incomplète fausserait des scores.
 *
 * Les positions officielles sont reprises telles quelles, sans renumérotation :
 * un pilote classé que nous ne connaissons pas garde sa place (les autres ne
 * remontent pas à tort).
 */
export function computeRevisedPositions(
  stored:   ClassificationEntry[],
  official: ClassificationEntry[],
): Map<string, number> | null {
  if (official.length === 0) return null

  const officialPositions = official.flatMap((entry) => entry.position !== null ? [entry.position] : [])
  if (new Set(officialPositions).size !== officialPositions.length) return null

  const officialByCode = new Map(official.map((entry) => [entry.driverCode, entry.position]))
  if (stored.some((entry) => !officialByCode.has(entry.driverCode))) return null

  const lastClassifiedPosition = Math.max(0, ...officialPositions)
  const unclassified = stored
    .filter((entry) => officialByCode.get(entry.driverCode) === null)
    .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity))

  const revised = new Map<string, number>()
  for (const entry of stored) {
    const officialPosition = officialByCode.get(entry.driverCode)
    if (officialPosition != null) revised.set(entry.driverCode, officialPosition)
  }
  unclassified.forEach((entry, index) => revised.set(entry.driverCode, lastClassifiedPosition + index + 1))

  const changes = new Map<string, number>()
  for (const entry of stored) {
    const position = revised.get(entry.driverCode)!
    if (position !== entry.position) changes.set(entry.driverCode, position)
  }
  return changes.size > 0 ? changes : null
}
