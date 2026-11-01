import { describe, it, expect } from 'vitest'
import {
  diffLineup,
  formatLineupChangeBody,
  selectLineupSessionCandidates,
  isLineupSessionTrusted,
  isLineupSessionAuthoritative,
  isSeatTaken,
  lineupTeamByCode,
  selectDriversToEnroll,
  LINEUP_SESSION_TRUST_DELAY_MS,
} from './lineup-changes'
import type { DbSessionType } from '@/lib/scoring/types'

describe('selectLineupSessionCandidates', () => {
  const horizon = 24 * 60 * 60 * 1000

  // Week-end sprint du GP Pays-Bas 2026 — le cas réel de #214.
  const weekend: { type: DbSessionType; startsAt: string }[] = [
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

  it('dimanche pendant une course à rallonge : la course démarrée non fiable ne masque pas les qualifs fiables (#218)', () => {
    // Course partie à 13:00, drapeaux rouges — à 16:30 (H+3h30) un délai
    // uniforme H+3 l'aurait déclarée fiable alors qu'elle peut encore courir.
    // Avec H+4 elle reste non fiable : les qualifs de samedi (fiables) font foi.
    const sundayDuringLongRace = new Date('2026-08-23T16:30:00Z').getTime()
    expect(selectLineupSessionCandidates(weekend, sundayDuringLongRace, horizon).map((s) => s.type))
      .toEqual(['qualifying', 'sprint_race', 'sprint_qualifying', 'practice_1'])
  })
})

describe('isLineupSessionTrusted', () => {
  const startsAt = '2026-08-21T10:30:00Z' // EL1 du GP Pays-Bas 2026

  it('fiable une fois le délai de confiance de SON type écoulé après le DÉBUT', () => {
    const atTrustBoundary = new Date(startsAt).getTime() + LINEUP_SESSION_TRUST_DELAY_MS.practice_1
    expect(isLineupSessionTrusted('practice_1', startsAt, atTrustBoundary)).toBe(true)
    expect(isLineupSessionTrusted('practice_1', startsAt, atTrustBoundary - 1)).toBe(false)
  })

  it('une session en cours ou à peine finie n\'est pas fiable (son /drivers peut être le pré-seed)', () => {
    const duringSession = new Date('2026-08-21T11:00:00Z').getTime()
    expect(isLineupSessionTrusted('practice_1', startsAt, duringSession)).toBe(false)
  })

  it('la course exige H+4 : une course à drapeaux rouges encore possible à H+3 n\'est pas fiable (#218)', () => {
    const raceStart = '2026-08-23T13:00:00Z'
    const threeHoursIn = new Date('2026-08-23T16:00:00Z').getTime()
    const fourHoursIn  = new Date('2026-08-23T17:00:00Z').getTime()
    expect(isLineupSessionTrusted('race', raceStart, threeHoursIn)).toBe(false)
    expect(isLineupSessionTrusted('race', raceStart, fourHoursIn)).toBe(true)
  })

  it('les sessions courtes basculent fiables dès H+2h30 (badge posé plus tôt le vendredi)', () => {
    const twoAndAHalfHoursIn = new Date('2026-08-21T13:00:00Z').getTime()
    expect(isLineupSessionTrusted('practice_1', startsAt, twoAndAHalfHoursIn)).toBe(true)
    expect(isLineupSessionTrusted('sprint_qualifying', '2026-08-21T14:30:00Z', twoAndAHalfHoursIn)).toBe(false)
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
      { driverCode: 'LAW', from: 'Racing Bulls', to: 'Red Bull Racing', replacedDriverCode: null },
    ])
  })

  it('pilote absent de la baseline (réserviste, retour de forfait) → changement avec from null', () => {
    const previous = new Map([['VER', 'Red Bull Racing']])
    const current  = new Map([['VER', 'Red Bull Racing'], ['TSU', 'Racing Bulls']])

    expect(diffLineup(previous, current)).toEqual([
      { driverCode: 'TSU', from: null, to: 'Racing Bulls', replacedDriverCode: null },
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

    // Lawson prend le baquet de Hadjar (absent) ; Tsunoda arrive chez Racing
    // Bulls dont l'ancien pilote (Lawson) est toujours en piste → pas de remplacé.
    expect(diffLineup(previous, current)).toEqual([
      { driverCode: 'LAW', from: 'Racing Bulls', to: 'Red Bull Racing', replacedDriverCode: 'HAD' },
      { driverCode: 'TSU', from: null,           to: 'Racing Bulls',    replacedDriverCode: null },
    ])
  })

  // #255 — GP du Mexique 2026 : Hirakawa remplace Ocon chez Haas.
  it('remplaçant d\'un titulaire absent → remplacé identifié', () => {
    const previous = new Map([['OCO', 'Haas F1 Team'], ['BEA', 'Haas F1 Team']])
    const current  = new Map([['HIR', 'Haas F1 Team'], ['BEA', 'Haas F1 Team']])

    expect(diffLineup(previous, current)).toEqual([
      { driverCode: 'HIR', from: null, to: 'Haas F1 Team', replacedDriverCode: 'OCO' },
    ])
  })

  it('remplacé ambigu (deux titulaires absents de la même écurie) → aucun', () => {
    const previous = new Map([['OCO', 'Haas F1 Team'], ['BEA', 'Haas F1 Team']])
    const current  = new Map([['HIR', 'Haas F1 Team'], ['XXX', 'Haas F1 Team']])

    expect(diffLineup(previous, current).map((change) => change.replacedDriverCode)).toEqual([null, null])
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

  it('remplacement → « X remplace Y chez Z », combinable avec un changement simple', () => {
    expect(formatLineupChangeBody([
      { displayName: 'Hirakawa', teamName: 'Haas F1 Team', replacedDisplayName: 'Ocon' },
      { displayName: 'Tsunoda',  teamName: 'Racing Bulls', replacedDisplayName: null },
    ])).toBe('Hirakawa remplace Ocon chez Haas F1 Team, Tsunoda pour Racing Bulls ce week-end. Vérifie tes pronos et tes items avant le départ !')
  })
})

describe('isLineupSessionAuthoritative', () => {
  it('fait foi : session fiable hors EL1', () => {
    for (const type of ['practice_2', 'practice_3', 'sprint_qualifying', 'sprint_race', 'qualifying', 'race'] as DbSessionType[]) {
      expect(isLineupSessionAuthoritative(type, true)).toBe(true)
    }
  })

  it('jamais l\'EL1 (rookies), jamais une session non fiable (pré-seed)', () => {
    expect(isLineupSessionAuthoritative('practice_1', true)).toBe(false)
    expect(isLineupSessionAuthoritative('qualifying', false)).toBe(false)
  })
})

describe('lineupTeamByCode', () => {
  it('réduit le line-up à code → libellé écurie', () => {
    expect(lineupTeamByCode([
      { driverCode: 'HIR', driverNumber: 50, firstName: 'Ryo', lastName: 'Hirakawa', teamName: 'Haas F1 Team' },
    ])).toEqual(new Map([['HIR', 'Haas F1 Team']]))
  })
})

describe('selectDriversToEnroll', () => {
  const hirakawa = { driverCode: 'HIR', driverNumber: 50, firstName: 'Ryo', lastName: 'Hirakawa', teamName: 'Haas F1 Team' }
  const bearman  = { driverCode: 'BEA', driverNumber: 87, firstName: 'Oliver', lastName: 'Bearman', teamName: 'Haas F1 Team' }

  it('retient les seuls pilotes inconnus de la saison', () => {
    expect(selectDriversToEnroll([hirakawa, bearman], { codes: new Set(['BEA']), numbers: new Set([87]) })).toEqual([hirakawa])
  })

  it('écarte un pilote sans nom ou sans numéro exploitable', () => {
    expect(selectDriversToEnroll([
      { ...hirakawa, lastName: null },
      { ...hirakawa, firstName: '' },
      { ...hirakawa, driverNumber: 0 },
    ], { codes: new Set(), numbers: new Set() })).toEqual([])
  })

  // Trigramme OpenF1 ≠ code Jolpica pour un pilote connu : même numéro → pas de doublon.
  it('écarte un code inconnu dont le numéro appartient déjà à un pilote de la saison', () => {
    expect(selectDriversToEnroll([{ ...bearman, driverCode: 'BRM' }], { codes: new Set(['BEA']), numbers: new Set([87]) })).toEqual([])
  })
})

describe('isSeatTaken', () => {
  // Line-up réel des EL3 du Mexique 2026 (extrait) : Lawson omis par OpenF1
  // alors qu'il a couru, Ocon réellement remplacé par Hirakawa.
  const mexicoPractice3 = new Map([
    ['HIR', 'Haas F1 Team'],
    ['BEA', 'Haas F1 Team'],
    ['LIN', 'Racing Bulls'],
  ])

  it('baquet occupé par deux autres pilotes → remplacement (Ocon)', () => {
    expect(isSeatTaken('Haas F1 Team', mexicoPractice3)).toBe(true)
  })

  it('un seul pilote de l\'écurie présent → simple omission, pas un remplacement (Lawson)', () => {
    expect(isSeatTaken('Racing Bulls', mexicoPractice3)).toBe(false)
  })

  it('écurie absente du line-up → pas un remplacement', () => {
    expect(isSeatTaken('Williams', mexicoPractice3)).toBe(false)
  })
})
