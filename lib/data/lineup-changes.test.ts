import { describe, it, expect } from 'vitest'
import { diffLineup, formatLineupChangeBody, selectLineupSessionCandidates } from './lineup-changes'

describe('selectLineupSessionCandidates', () => {
  const now = new Date('2026-08-23T09:00:00Z').getTime()   // dimanche matin
  const horizon = 24 * 60 * 60 * 1000

  const weekend = [
    { type: 'practice_1', startsAt: '2026-08-21T10:30:00Z' },  // vendredi — passée
    { type: 'qualifying', startsAt: '2026-08-22T14:00:00Z' },  // samedi — passée
    { type: 'race',       startsAt: '2026-08-23T13:00:00Z' },  // dimanche — dans 4 h
  ]

  it('ordre décroissant : la session la plus fraîche d\'abord (remplacement du dimanche)', () => {
    // Régression : en ordre croissant, les EL1 du vendredi (toujours publiées)
    // répondraient en premier et masqueraient un remplacement de dernière minute
    // visible uniquement dans les /drivers de la course.
    expect(selectLineupSessionCandidates(weekend, now, horizon).map((s) => s.type))
      .toEqual(['race', 'qualifying', 'practice_1'])
  })

  it('exclut les sessions au-delà de l\'horizon, garde les sessions passées', () => {
    const friday = new Date('2026-08-21T08:00:00Z').getTime()
    // Vendredi matin : EL1 dans 2h30 (dans l'horizon), qualif samedi 14h (30 h → exclue)
    expect(selectLineupSessionCandidates(weekend, friday, horizon).map((s) => s.type))
      .toEqual(['practice_1'])
  })

  it('aucune session dans l\'horizon → liste vide', () => {
    const monday = new Date('2026-08-17T09:00:00Z').getTime()
    expect(selectLineupSessionCandidates(weekend, monday, horizon)).toEqual([])
  })
})

describe('diffLineup', () => {
  it('baseline vide (premier GP suivi) → aucun changement, on sème sans notifier', () => {
    const current = new Map([['VER', 'Red Bull Racing'], ['LEC', 'Ferrari']])
    expect(diffLineup(new Map(), current)).toEqual([])
  })

  it('line-up identique → aucun changement', () => {
    const lineup = new Map([['VER', 'Red Bull Racing'], ['LEC', 'Ferrari']])
    expect(diffLineup(lineup, new Map(lineup))).toEqual([])
  })

  it('pilote qui change d\'écurie → changement avec from/to', () => {
    const previous = new Map([['LAW', 'Racing Bulls'], ['VER', 'Red Bull Racing']])
    const current  = new Map([['LAW', 'Red Bull Racing'], ['VER', 'Red Bull Racing']])

    expect(diffLineup(previous, current)).toEqual([
      { driverCode: 'LAW', from: 'Racing Bulls', to: 'Red Bull Racing' },
    ])
  })

  it('pilote absent de la baseline (réserviste, retour de forfait) → changement avec from null', () => {
    const previous = new Map([['VER', 'Red Bull Racing']])
    const current  = new Map([['VER', 'Red Bull Racing'], ['TSU', 'Racing Bulls']])

    expect(diffLineup(previous, current)).toEqual([
      { driverCode: 'TSU', from: null, to: 'Racing Bulls' },
    ])
  })

  it('pilote disparu du GP courant (forfait) → ignoré, le remplaçant porte l\'info', () => {
    const previous = new Map([['HAD', 'Red Bull Racing'], ['VER', 'Red Bull Racing']])
    const current  = new Map([['VER', 'Red Bull Racing']])

    expect(diffLineup(previous, current)).toEqual([])
  })

  // Scénario complet #205 : Hadjar blessé → Lawson monte chez Red Bull,
  // Tsunoda prend le baquet Racing Bulls. Deux changements, un seul push agrégé.
  it('échange en chaîne : deux changements détectés, le forfait n\'en génère pas', () => {
    const previous = new Map([
      ['VER', 'Red Bull Racing'],
      ['HAD', 'Red Bull Racing'],
      ['LAW', 'Racing Bulls'],
      ['LEC', 'Ferrari'],
    ])
    const current = new Map([
      ['VER', 'Red Bull Racing'],
      ['LAW', 'Red Bull Racing'],
      ['TSU', 'Racing Bulls'],
      ['LEC', 'Ferrari'],
    ])

    expect(diffLineup(previous, current)).toEqual([
      { driverCode: 'LAW', from: 'Racing Bulls', to: 'Red Bull Racing' },
      { driverCode: 'TSU', from: null,           to: 'Racing Bulls' },
    ])
  })
})

describe('formatLineupChangeBody', () => {
  it('un seul changement → phrase complète', () => {
    expect(formatLineupChangeBody([{ displayName: 'Lawson', teamName: 'Red Bull Racing' }]))
      .toBe('Lawson pilote pour Red Bull Racing ce week-end. Vérifie tes pronos et tes items avant le départ !')
  })

  it('plusieurs changements → agrégés en une seule phrase', () => {
    expect(formatLineupChangeBody([
      { displayName: 'Lawson',  teamName: 'Red Bull Racing' },
      { displayName: 'Tsunoda', teamName: 'Racing Bulls' },
    ])).toBe('Lawson pilote pour Red Bull Racing, Tsunoda pour Racing Bulls ce week-end. Vérifie tes pronos et tes items avant le départ !')
  })
})
