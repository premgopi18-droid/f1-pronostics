import { describe, it, expect } from 'vitest'
import { computeRevisedPositions, type ClassificationEntry } from './session-revision'

const entries = (codes: (string | null)[]): ClassificationEntry[] =>
  codes.flatMap((code, index) => (code ? [{ driverCode: code, position: index + 1 }] : []))

describe('computeRevisedPositions', () => {
  // GP du Mexique 2026 : classement Jolpica (pré-pénalités) vs OpenF1 après
  // les pénalités de Piastri, Colapinto et Gasly. Abandons sans position chez
  // OpenF1, classés 18 à 22 chez Jolpica.
  const storedRace: ClassificationEntry[] = entries([
    'VER', 'HAM', 'ANT', 'LEC', 'NOR', 'RUS', 'PIA', 'COL', 'LAW', 'GAS', 'BOR',
    'HAD', 'HIR', 'ALB', 'SAI', 'HUL', 'PER', 'LIN', 'BEA', 'BOT', 'STR', 'ALO',
  ])
  const officialRace: ClassificationEntry[] = [
    ...entries(['VER', 'HAM', 'ANT', 'LEC', 'NOR', 'RUS', 'LAW', 'BOR', 'HAD', 'HIR', 'ALB', 'SAI', 'PIA', 'HUL', 'COL', 'PER', 'GAS']),
    ...['LIN', 'BEA', 'BOT', 'STR', 'ALO'].map((code) => ({ driverCode: code, position: null })),
  ]

  it('pénalités d\'après-course : seuls les pilotes déplacés changent, les abandons gardent 18 à 22', () => {
    expect(computeRevisedPositions(storedRace, officialRace)).toEqual({
      kind: 'revised',
      positions: new Map([
        ['LAW', 7], ['BOR', 8], ['HAD', 9], ['HIR', 10], ['ALB', 11], ['SAI', 12],
        ['PIA', 13], ['HUL', 14], ['COL', 15], ['PER', 16], ['GAS', 17],
      ]),
    })
  })

  // Stabilité : une fois révisé, le classement ne rebascule pas au passage
  // suivant (sinon scores supprimés/recalculés en boucle).
  it('classement déjà révisé → inchangé (abandons sans position chez OpenF1 inclus)', () => {
    const outcome = computeRevisedPositions(storedRace, officialRace)
    const positions = outcome.kind === 'revised' ? outcome.positions : new Map<string, number>()
    const revisedStored = storedRace.map((entry) => ({ ...entry, position: positions.get(entry.driverCode) ?? entry.position }))
    expect(computeRevisedPositions(revisedStored, officialRace)).toEqual({ kind: 'unchanged' })
  })

  // Qualifs du Mexique : Lawson disqualifié après la séance, sans position chez
  // OpenF1 (et dsq:false) → classé dernier, les pilotes derrière lui remontent.
  it('disqualifié sans position officielle → classé derrière tous les classés', () => {
    const stored = entries(['HAM', 'LAW', 'LIN', 'GAS'])
    const official: ClassificationEntry[] = [
      { driverCode: 'HAM', position: 1 },
      { driverCode: 'LAW', position: null },
      { driverCode: 'LIN', position: 2 },
      { driverCode: 'GAS', position: 3 },
    ]
    expect(computeRevisedPositions(stored, official)).toEqual({
      kind: 'revised',
      positions: new Map([['LAW', 4], ['LIN', 2], ['GAS', 3]]),
    })
  })

  it('disqualifié signalé (dsq) → derrière les abandons, même s\'il était stocké devant', () => {
    const stored = entries(['VER', 'HAM', 'LEC', 'NOR'])
    const official: ClassificationEntry[] = [
      { driverCode: 'VER', position: 1 },
      { driverCode: 'HAM', position: null, disqualified: true },
      { driverCode: 'LEC', position: 2 },
      { driverCode: 'NOR', position: null },
    ]
    expect(computeRevisedPositions(stored, official)).toEqual({
      kind: 'revised',
      positions: new Map([['HAM', 4], ['LEC', 2], ['NOR', 3]]),
    })
  })

  it('positions officielles reprises telles quelles : un classé inconnu de nous garde sa place', () => {
    const stored = entries(['HAM', 'RUS', null, 'STR'])
    const official = entries(['HAM', 'RUS', 'HIR', 'STR'])
    expect(computeRevisedPositions(stored, official)).toEqual({ kind: 'unchanged' })
  })

  describe('classement officiel inexploitable → aucune révision, raison exposée pour les logs', () => {
    it('classement officiel vide (pas encore publié)', () => {
      expect(computeRevisedPositions(storedRace, []).kind).toBe('unusable')
    })

    // Fréquent en sprint qualif : /session_result omet des pilotes présents dans /position.
    it('pilote stocké absent du classement officiel (publication partielle)', () => {
      expect(computeRevisedPositions(storedRace, officialRace.filter((entry) => entry.driverCode !== 'GAS')))
        .toEqual({ kind: 'unusable', reason: 'absents du classement officiel : GAS' })
    })

    it('position officielle en double', () => {
      const official = officialRace.map((entry) => (entry.driverCode === 'GAS' ? { ...entry, position: 1 } : entry))
      expect(computeRevisedPositions(storedRace, official).kind).toBe('unusable')
    })
  })
})
