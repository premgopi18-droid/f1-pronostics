import { describe, it, expect } from 'vitest'
import { computeGpStatuses } from './calendar'

const NOW     = new Date('2026-06-23T12:00:00Z').getTime()
const PAST    = '2026-06-01T12:00:00Z'
const FUTURE_NEAR = '2026-07-05T12:00:00Z'
const FUTURE_FAR  = '2026-07-19T12:00:00Z'

describe('computeGpStatuses', () => {
  it('liste vide → tableau vide', () => {
    expect(computeGpStatuses([], NOW)).toEqual([])
  })

  it('résultats confirmés partout → tout completed', () => {
    const gps = [
      { raceResultsConfirmedAt: PAST, qualifyingStartsAt: null },
      { raceResultsConfirmedAt: PAST, qualifyingStartsAt: null },
    ]
    expect(computeGpStatuses(gps, NOW)).toEqual(['completed', 'completed'])
  })

  it('premier sans résultats → prochain', () => {
    const gps = [
      { raceResultsConfirmedAt: PAST, qualifyingStartsAt: null },
      { raceResultsConfirmedAt: null, qualifyingStartsAt: FUTURE_NEAR },
      { raceResultsConfirmedAt: null, qualifyingStartsAt: FUTURE_FAR },
    ]
    const statuses = computeGpStatuses(gps, NOW)
    expect(statuses[0]).toBe('completed')
    expect(statuses[1]).toBe('prochain')
    expect(statuses[2]).toBe('predictable')
  })

  it('predictable si quali dans le futur (non prochain)', () => {
    const gps = [
      { raceResultsConfirmedAt: null, qualifyingStartsAt: FUTURE_NEAR },
      { raceResultsConfirmedAt: null, qualifyingStartsAt: FUTURE_FAR },
    ]
    const statuses = computeGpStatuses(gps, NOW)
    expect(statuses[0]).toBe('prochain')
    expect(statuses[1]).toBe('predictable')
  })

  it('upcoming si qualifyingStartsAt est null (pas encore en base)', () => {
    const gps = [
      { raceResultsConfirmedAt: null, qualifyingStartsAt: FUTURE_NEAR },
      { raceResultsConfirmedAt: null, qualifyingStartsAt: null },
    ]
    const statuses = computeGpStatuses(gps, NOW)
    expect(statuses[1]).toBe('upcoming')
  })

  it('upcoming si quali déjà passée mais résultats pas encore confirmés (GP en cours)', () => {
    const gps = [
      { raceResultsConfirmedAt: null, qualifyingStartsAt: PAST },
      { raceResultsConfirmedAt: null, qualifyingStartsAt: FUTURE_FAR },
    ]
    const statuses = computeGpStatuses(gps, NOW)
    expect(statuses[0]).toBe('prochain')
    expect(statuses[1]).toBe('predictable')
  })

  it('aucun résultat confirmé → premier est prochain', () => {
    const gps = [
      { raceResultsConfirmedAt: null, qualifyingStartsAt: FUTURE_NEAR },
    ]
    expect(computeGpStatuses(gps, NOW)).toEqual(['prochain'])
  })
})
