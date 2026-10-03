import type { CalendarEntry } from '@/lib/f1/jolpica'
import type { DbSessionType } from '@/lib/scoring/types'

// Rapprochement calendrier Jolpica ↔ GPs en base (#253).
//
// Un GP est identifié par son CIRCUIT, pas par son numéro de manche : quand le
// calendrier change en cours de saison (GP délocalisé inséré, GP annulé), les
// rounds glissent. Rapprocher par round renommait la ligne d'un autre GP —
// ses pronos, items et sessions passaient au GP voisin (Abu Dhabi → Qatar,
// sessions sprint de Singapour restées sur la Malaisie).

// Au-delà, un calendrier qui annulerait autant de GPs d'un coup est jugé
// suspect (réponse Jolpica partielle) : rien n'est écrit, la sync logue.
export const MAX_CANCELLATIONS_PER_SYNC = 3

export interface ExistingGrandPrix {
  id:                  string
  round:               number
  circuit:             string
  circuitRef:          string | null   // null : ligne antérieure à #253, rapprochée par nom de circuit
  isCancelled:         boolean
  hasConfirmedResults: boolean
}

export interface CalendarReconciliation {
  matched:   { id: string; entry: CalendarEntry }[]
  inserted:  CalendarEntry[]
  // GPs disparus du calendrier → is_cancelled (non destructif : réactivés s'ils reviennent)
  cancelled: string[]
  // GPs disparus mais déjà courus (résultats confirmés) : laissés tels quels
  orphanedWithResults: string[]
}

export function reconcileCalendar(
  entries:  CalendarEntry[],
  existing: ExistingGrandPrix[],
): CalendarReconciliation {
  // Parcours par round croissant des deux côtés : si un circuit accueille deux
  // GPs dans la saison, ils sont appariés dans l'ordre chronologique.
  const sortedEntries   = [...entries].sort((a, b) => a.round - b.round)
  const sortedExisting  = [...existing].sort((a, b) => a.round - b.round)
  const matchedIds      = new Set<string>()
  const matchByEntry    = new Map<CalendarEntry, string>()

  const claim = (entry: CalendarEntry, isCandidate: (gp: ExistingGrandPrix) => boolean) => {
    const candidate = sortedExisting.find((gp) => !matchedIds.has(gp.id) && isCandidate(gp))
    if (!candidate) return
    matchedIds.add(candidate.id)
    matchByEntry.set(entry, candidate.id)
  }

  // Passe 1 : identifiant de circuit. Passe 2 : nom de circuit, uniquement
  // pour les lignes sans circuit_ref (elles en reçoivent un à l'application).
  for (const entry of sortedEntries) {
    claim(entry, (gp) => gp.circuitRef === entry.circuitRef)
  }
  for (const entry of sortedEntries) {
    if (matchByEntry.has(entry)) continue
    claim(entry, (gp) => gp.circuitRef === null && gp.circuit === entry.circuit)
  }

  const unmatched = sortedExisting.filter((gp) => !matchedIds.has(gp.id))

  return {
    matched:  sortedEntries
      .filter((entry) => matchByEntry.has(entry))
      .map((entry) => ({ id: matchByEntry.get(entry)!, entry })),
    inserted: sortedEntries.filter((entry) => !matchByEntry.has(entry)),
    cancelled: unmatched
      .filter((gp) => !gp.isCancelled && !gp.hasConfirmedResults)
      .map((gp) => gp.id),
    orphanedWithResults: unmatched
      .filter((gp) => !gp.isCancelled && gp.hasConfirmedResults)
      .map((gp) => gp.id),
  }
}

/** Motif de refus d'appliquer le rapprochement, ou null s'il est sûr. */
export function findUnsafeReconciliationReason(
  entries:        CalendarEntry[],
  reconciliation: CalendarReconciliation,
): string | null {
  if (entries.length === 0) return 'calendrier Jolpica vide'
  if (reconciliation.cancelled.length > MAX_CANCELLATIONS_PER_SYNC) {
    return `${reconciliation.cancelled.length} GPs seraient annulés d'un coup (max ${MAX_CANCELLATIONS_PER_SYNC})`
  }
  return null
}

/** Sessions attendues pour un GP du calendrier — toute autre session du GP est obsolète. */
export function sessionsForCalendarEntry(
  entry: CalendarEntry,
): { type: DbSessionType; startsAt: string }[] {
  const sessions: { type: DbSessionType; startsAt: string }[] = [
    { type: 'qualifying', startsAt: entry.qualifyingStartsAt },
    { type: 'race',       startsAt: entry.raceStartsAt },
  ]
  if (entry.isSprintWeekend) {
    if (entry.sprintQualStartsAt) sessions.push({ type: 'sprint_qualifying', startsAt: entry.sprintQualStartsAt })
    if (entry.sprintRaceStartsAt) sessions.push({ type: 'sprint_race',       startsAt: entry.sprintRaceStartsAt })
  }
  if (entry.practice1StartsAt) sessions.push({ type: 'practice_1', startsAt: entry.practice1StartsAt })
  if (entry.practice2StartsAt) sessions.push({ type: 'practice_2', startsAt: entry.practice2StartsAt })
  if (entry.practice3StartsAt) sessions.push({ type: 'practice_3', startsAt: entry.practice3StartsAt })
  return sessions
}
