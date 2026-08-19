import { describe, it, expect } from 'vitest'
import { diffLineup, formatLineupChangeBody } from './lineup-changes'

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
