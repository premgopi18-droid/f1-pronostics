import { describe, it, expect } from 'vitest'
import {
  MAX_CANCELLATIONS_PER_SYNC,
  findUnsafeReconciliationReason,
  isCalendarEntryScheduleComplete,
  reconcileCalendar,
  sessionsForCalendarEntry,
  type ExistingGrandPrix,
} from './calendar-reconciliation'
import type { CalendarEntry } from './jolpica'

function entry(round: number, circuitRef: string, overrides: Partial<CalendarEntry> = {}): CalendarEntry {
  return {
    season:             2026,
    round,
    name:               `GP ${circuitRef}`,
    circuit:            `Circuit ${circuitRef}`,
    circuitRef,
    country:            'Pays',
    isSprintWeekend:    false,
    weekendStartsAt:    '2026-10-03T08:00:00Z',
    qualifyingStartsAt: '2026-10-03T08:00:00Z',
    raceStartsAt:       '2026-10-04T07:00:00Z',
    sprintRaceStartsAt: null,
    sprintQualStartsAt: null,
    practice1StartsAt:  null,
    practice2StartsAt:  null,
    practice3StartsAt:  null,
    ...overrides,
  }
}

function existing(id: string, round: number, circuitRef: string | null, overrides: Partial<ExistingGrandPrix> = {}): ExistingGrandPrix {
  return {
    id,
    round,
    circuit:             `Circuit ${circuitRef ?? id}`,
    circuitRef,
    isCancelled:         false,
    hasConfirmedResults: false,
    ...overrides,
  }
}

describe('reconcileCalendar', () => {
  it('GP inséré en cours de saison : chaque GP garde sa ligne, seul le round glisse (#253)', () => {
    // Avant : 15 Bakou, 16 Singapour, 17 Austin. Jolpica insère la Malaisie en 16.
    const result = reconcileCalendar(
      [entry(15, 'baku'), entry(16, 'sepang'), entry(17, 'marina_bay'), entry(18, 'americas')],
      [existing('gp-baku', 15, 'baku'), existing('gp-singapore', 16, 'marina_bay'), existing('gp-austin', 17, 'americas')],
    )

    expect(result.matched.map(({ id, entry: e }) => [id, e.round])).toEqual([
      ['gp-baku', 15],
      ['gp-singapore', 17],
      ['gp-austin', 18],
    ])
    expect(result.inserted.map((e) => e.circuitRef)).toEqual(['sepang'])
    expect(result.cancelled).toEqual([])
  })

  it('GP retiré du calendrier : annulé, les suivants gardent leur identité', () => {
    const result = reconcileCalendar(
      [entry(1, 'albert_park'), entry(2, 'suzuka')],
      [existing('gp-australia', 1, 'albert_park'), existing('gp-bahrain', 2, 'bahrain'), existing('gp-japan', 3, 'suzuka')],
    )

    expect(result.cancelled).toEqual(['gp-bahrain'])
    expect(result.matched.map(({ id, entry: e }) => [id, e.round])).toEqual([['gp-australia', 1], ['gp-japan', 2]])
    expect(result.inserted).toEqual([])
  })

  it('GP disparu mais déjà couru : jamais annulé, signalé à part', () => {
    const result = reconcileCalendar(
      [entry(2, 'suzuka')],
      [existing('gp-done', 1, 'bahrain', { hasConfirmedResults: true }), existing('gp-japan', 2, 'suzuka')],
    )

    expect(result.cancelled).toEqual([])
    expect(result.orphanedWithResults).toEqual([{ id: 'gp-done', round: 1 }])
  })

  it('GP déjà annulé qui revient au calendrier : réactivé sur sa ligne (pronos conservés)', () => {
    const result = reconcileCalendar(
      [entry(4, 'bahrain')],
      [existing('gp-bahrain', 2, 'bahrain', { isCancelled: true })],
    )

    expect(result.matched).toEqual([{ id: 'gp-bahrain', entry: expect.objectContaining({ round: 4 }) }])
    expect(result.inserted).toEqual([])
  })

  it('GP déjà annulé et toujours absent : pas ré-annulé', () => {
    const result = reconcileCalendar([entry(1, 'albert_park')], [
      existing('gp-australia', 1, 'albert_park'),
      existing('gp-bahrain', 2, 'bahrain', { isCancelled: true }),
    ])

    expect(result.cancelled).toEqual([])
    expect(result.orphanedWithResults).toEqual([])
  })

  it('ligne historique sans circuit_ref : rapprochée par nom de circuit', () => {
    const result = reconcileCalendar(
      [entry(16, 'sepang', { circuit: 'Sepang International Circuit' })],
      [existing('gp-legacy', 16, null, { circuit: 'Sepang International Circuit' })],
    )

    expect(result.matched.map(({ id }) => id)).toEqual(['gp-legacy'])
  })

  it('circuitId renommé côté Jolpica : rapproché par nom de circuit, pas annulé + recréé', () => {
    const result = reconcileCalendar(
      [entry(1, 'new_ref', { circuit: 'Same Name' })],
      [existing('gp-kept', 1, 'old_ref', { circuit: 'Same Name' })],
    )

    expect(result.matched).toEqual([{ id: 'gp-kept', entry: expect.objectContaining({ circuitRef: 'new_ref' }) }])
    expect(result.inserted).toEqual([])
    expect(result.cancelled).toEqual([])
  })

  it("l'identifiant de circuit prime sur le nom", () => {
    // Le nom de « gp-by-ref » a changé, celui de « gp-by-name » correspond :
    // la passe par identifiant passe d'abord, le nom ne récupère que le reste.
    const result = reconcileCalendar(
      [entry(1, 'sepang', { circuit: 'Sepang' }), entry(2, 'other', { circuit: 'Other' })],
      [existing('gp-by-name', 1, 'other', { circuit: 'Sepang' }), existing('gp-by-ref', 2, 'sepang', { circuit: 'Old name' })],
    )

    expect(result.matched.map(({ id, entry: e }) => [id, e.circuitRef])).toEqual([['gp-by-ref', 'sepang'], ['gp-by-name', 'other']])
  })

  it('deux GPs sur le même circuit : appariés dans l’ordre chronologique', () => {
    const result = reconcileCalendar(
      [entry(9, 'red_bull_ring'), entry(10, 'red_bull_ring')],
      [existing('gp-second', 10, 'red_bull_ring'), existing('gp-first', 8, 'red_bull_ring')],
    )

    expect(result.matched.map(({ id, entry: e }) => [id, e.round])).toEqual([['gp-first', 9], ['gp-second', 10]])
  })
})

describe('findUnsafeReconciliationReason', () => {
  it('refuse un calendrier vide', () => {
    const reconciliation = reconcileCalendar([], [existing('gp-1', 1, 'a')])
    expect(findUnsafeReconciliationReason([], reconciliation)).toMatch(/vide/)
  })

  it(`refuse plus de ${MAX_CANCELLATIONS_PER_SYNC} annulations d'un coup`, () => {
    const entries = [entry(1, 'kept')]
    const gps = [existing('kept', 1, 'kept'), ...Array.from({ length: MAX_CANCELLATIONS_PER_SYNC + 1 }, (_, index) => existing(`gone-${index}`, index + 2, `gone-${index}`))]
    expect(findUnsafeReconciliationReason(entries, reconcileCalendar(entries, gps))).toMatch(/annulés/)
  })

  it('refuse si un GP déjà couru et absent du calendrier occupe une manche réattribuée', () => {
    const entries = [entry(1, 'suzuka')]
    const reconciliation = reconcileCalendar(entries, [existing('gp-done', 1, 'bahrain', { hasConfirmedResults: true })])
    expect(findUnsafeReconciliationReason(entries, reconciliation)).toMatch(/gp-done.*manche 1/)
  })

  it('accepte un GP déjà couru absent du calendrier si sa manche reste libre', () => {
    const entries = [entry(2, 'suzuka')]
    const reconciliation = reconcileCalendar(entries, [existing('gp-done', 1, 'bahrain', { hasConfirmedResults: true })])
    expect(findUnsafeReconciliationReason(entries, reconciliation)).toBeNull()
  })

  it(`accepte jusqu'à ${MAX_CANCELLATIONS_PER_SYNC} annulations`, () => {
    const entries = [entry(1, 'kept')]
    const gps = [existing('kept', 1, 'kept'), ...Array.from({ length: MAX_CANCELLATIONS_PER_SYNC }, (_, index) => existing(`gone-${index}`, index + 2, `gone-${index}`))]
    expect(findUnsafeReconciliationReason(entries, reconcileCalendar(entries, gps))).toBeNull()
  })
})

describe('isCalendarEntryScheduleComplete', () => {
  const classic = {
    practice1StartsAt: '2026-10-02T04:30:00Z',
    practice2StartsAt: '2026-10-02T08:00:00Z',
    practice3StartsAt: '2026-10-03T04:30:00Z',
  }
  const sprint = {
    isSprintWeekend:    true,
    practice1StartsAt:  '2026-10-09T08:30:00Z',
    sprintQualStartsAt: '2026-10-09T12:30:00Z',
    sprintRaceStartsAt: '2026-10-10T09:00:00Z',
  }

  it('week-end classique complet (EL1-2-3 + qualifs + course)', () => {
    expect(isCalendarEntryScheduleComplete(entry(16, 'sepang', classic))).toBe(true)
  })

  it('week-end sprint complet (EL1 + sprint qualif + sprint + qualifs + course)', () => {
    expect(isCalendarEntryScheduleComplete(entry(17, 'marina_bay', sprint))).toBe(true)
  })

  it('réponse partielle — horaires sprint perdus : week-end « classique » sans EL2/EL3 → incomplet', () => {
    // Le cas dangereux : sans ce garde-fou, les sessions sprint et leurs pronos seraient supprimés.
    expect(isCalendarEntryScheduleComplete(entry(17, 'marina_bay', { practice1StartsAt: sprint.practice1StartsAt }))).toBe(false)
  })

  it('sprint annoncé mais horaire de sprint qualif manquant → incomplet', () => {
    expect(isCalendarEntryScheduleComplete(entry(17, 'marina_bay', { ...sprint, sprintQualStartsAt: null }))).toBe(false)
  })

  it('qualifs manquantes (repli sur l’horaire de la course) → incomplet', () => {
    expect(isCalendarEntryScheduleComplete(entry(16, 'sepang', { ...classic, qualifyingStartsAt: '2026-10-04T07:00:00Z' }))).toBe(false)
  })

  it('EL1 manquante (GP lointain pas encore programmé) → incomplet', () => {
    expect(isCalendarEntryScheduleComplete(entry(16, 'sepang', { ...classic, practice1StartsAt: null }))).toBe(false)
  })
})

describe('sessionsForCalendarEntry', () => {
  it('week-end classique : aucune session sprint', () => {
    const types = sessionsForCalendarEntry(entry(16, 'sepang', {
      practice1StartsAt: '2026-10-02T04:30:00Z',
      practice2StartsAt: '2026-10-02T08:00:00Z',
      practice3StartsAt: '2026-10-03T04:30:00Z',
    })).map((session) => session.type)

    expect(types).toEqual(['qualifying', 'race', 'practice_1', 'practice_2', 'practice_3'])
  })

  it('week-end sprint : sprint qualif + sprint race', () => {
    const types = sessionsForCalendarEntry(entry(17, 'marina_bay', {
      isSprintWeekend:    true,
      sprintQualStartsAt: '2026-10-09T12:30:00Z',
      sprintRaceStartsAt: '2026-10-10T09:00:00Z',
      practice1StartsAt:  '2026-10-09T08:30:00Z',
    })).map((session) => session.type)

    expect(types).toEqual(['qualifying', 'race', 'sprint_qualifying', 'sprint_race', 'practice_1'])
  })
})
