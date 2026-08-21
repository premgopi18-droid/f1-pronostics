import { describe, expect, it } from 'vitest'
import { formatParis, formatParisWeekday, formatParisWeekdayTime } from './dates'

// 14:30 UTC un vendredi d'août = 16:30 heure de Paris (CEST, UTC+2).
const SUMMER_UTC_INSTANT = '2026-08-21T14:30:00Z'
// 23:30 UTC un samedi de janvier = 00:30 le DIMANCHE à Paris (CET, UTC+1) —
// le jour affiché doit basculer, c'est tout l'intérêt de l'épinglage du fuseau.
const WINTER_MIDNIGHT_CROSSING = '2026-01-24T23:30:00Z'

describe('formatParisWeekdayTime', () => {
  it('convertit UTC vers l heure de Paris (été, UTC+2)', () => {
    expect(formatParisWeekdayTime(SUMMER_UTC_INSTANT)).toBe('ven. 16:30')
  })

  it('bascule de jour à minuit heure de Paris (hiver, UTC+1)', () => {
    expect(formatParisWeekdayTime(WINTER_MIDNIGHT_CROSSING)).toBe('dim. 00:30')
  })

  it('accepte un Date comme une string ISO', () => {
    expect(formatParisWeekdayTime(new Date(SUMMER_UTC_INSTANT))).toBe('ven. 16:30')
  })
})

describe('formatParisWeekday', () => {
  it('jour abrégé seul, sans double point possible', () => {
    expect(formatParisWeekday(SUMMER_UTC_INSTANT)).toBe('ven.')
  })
})

describe('formatParis', () => {
  it('date longue épinglée Paris (pas de recul de jour en UTC)', () => {
    expect(formatParis(WINTER_MIDNIGHT_CROSSING, { day: 'numeric', month: 'long', year: 'numeric' })).toBe(
      '25 janvier 2026',
    )
  })
})
