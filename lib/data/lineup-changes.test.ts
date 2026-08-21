import { describe, it, expect } from 'vitest'
import { diffLineup, formatLineupChangeBody, selectLineupSessionCandidates } from './lineup-changes'

describe('selectLineupSessionCandidates', () => {
  const horizon = 24 * 60 * 60 * 1000

  // Week-end sprint du GP Pays-Bas 2026 — le cas réel de #214.
  const weekend = [
    { type: 'practice_1',        startsAt: '2026-08-21T10:30:00Z' },  // vendredi
    { type: 'sprint_qualifying', startsAt: '2026-08-21T14:30:00Z' },  // vendredi
    { type: 'sprint_race',       startsAt: '2026-08-22T10:00:00Z' },  // samedi
    { type: 'qualifying',        startsAt: '2026-08-22T14:00:00Z' },  // samedi
    { type: 'race',              startsAt: '2026-08-23T13:00:00Z' },  // dimanche
  ]

  it('sessions fiables uniquement, la plus fraîche d\'abord — ni future ni fraîchement démarrée ne les masque (#214)', () => {
    // Samedi 14:05 : la qualif vient de démarrer (14:00) → son /drivers est
    // encore le pré-seed périmé, elle ne doit PAS masquer le sprint couru le
    // matin (fiable depuis 13:00). La course de dimanche (future) non plus.
    const saturdayAfterQualifyingStart = new Date('2026-08-22T14:05:00Z').getTime()
    expect(selectLineupSessionCandidates(weekend, saturdayAfterQualifyingStart, horizon).map((s) => s.type))
      .toEqual(['sprint_race', 'sprint_qualifying', 'practice_1'])
  })

  it('aucune session fiable → une session démarrée est consultée (sa donnée peut avoir déjà basculé), jamais une future', () => {
    // Vendredi 12:40 : EL1 courues (10:30-11:30) mais pas encore « fiables »
    // (< 3 h) — leur /drivers a pu basculer, c'est la meilleure source
    // disponible. Le sprint qualif de 14:30 (futur, pré-seed) est exclu.
    const fridayAfterPractice = new Date('2026-08-21T12:40:00Z').getTime()
    expect(selectLineupSessionCandidates(weekend, fridayAfterPractice, horizon).map((s) => s.type))
      .toEqual(['practice_1'])
  })

  it('aucune session démarrée → repli sur le pré-seed des sessions à venir dans l\'horizon, la plus proche d\'abord', () => {
    // Jeudi / vendredi matin : le pré-seed OpenF1 est la seule donnée
    // disponible — il sert à semer la baseline du GP.
    const fridayBeforePractice = new Date('2026-08-21T08:00:00Z').getTime()
    expect(selectLineupSessionCandidates(weekend, fridayBeforePractice, horizon).map((s) => s.type))
      .toEqual(['practice_1', 'sprint_qualifying'])
  })

  it('aucune session démarrée ni à venir dans l\'horizon → liste vide', () => {
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
