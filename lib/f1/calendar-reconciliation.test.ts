import { describe, it, expect } from 'vitest'
import {
  MAX_CANCELLATIONS_PER_SYNC,
  findUnsafeReconciliationReason,
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
    expect(result.orphanedWithResults).toEqual(['gp-done'])
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

  it("le nom de circuit ne vole pas une ligne qui a déjà un circuit_ref différent", () => {
    const result = reconcileCalendar(
      [entry(1, 'new_ref', { circuit: 'Same Name' })],
      [existing('gp-other', 1, 'old_ref', { circuit: 'Same Name' })],
    )

    expect(result.inserted.map((e) => e.circuitRef)).toEqual(['new_ref'])
    expect(result.cancelled).toEqual(['gp-other'])
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

  it(`accepte jusqu'à ${MAX_CANCELLATIONS_PER_SYNC} annulations`, () => {
    const entries = [entry(1, 'kept')]
    const gps = [existing('kept', 1, 'kept'), ...Array.from({ length: MAX_CANCELLATIONS_PER_SYNC }, (_, index) => existing(`gone-${index}`, index + 2, `gone-${index}`))]
    expect(findUnsafeReconciliationReason(entries, reconcileCalendar(entries, gps))).toBeNull()
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
