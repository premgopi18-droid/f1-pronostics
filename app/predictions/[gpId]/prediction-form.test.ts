import { describe, it, expect } from 'vitest'
import {
  buildRaceOrder,
  buildPrefilledRaceOrder,
  buildPrefilledTopEntries,
  isGridPrefilled,
} from '@/lib/predictions/helpers'

describe('buildRaceOrder', () => {
  const allCodes = ['VER', 'LEC', 'NOR', 'HAM', 'RUS']

  it("retourne tous les codes dans l'ordre par défaut quand aucune entrée existante", () => {
    expect(buildRaceOrder([], allCodes)).toEqual(['VER', 'LEC', 'NOR', 'HAM', 'RUS'])
  })

  it('place les entrées existantes en premier, les pilotes manquants ensuite', () => {
    expect(buildRaceOrder(['NOR', 'LEC'], allCodes)).toEqual(['NOR', 'LEC', 'VER', 'HAM', 'RUS'])
  })

  it('retourne le même ordre quand tous les pilotes sont déjà placés', () => {
    const full = ['HAM', 'VER', 'LEC', 'NOR', 'RUS']
    expect(buildRaceOrder(full, allCodes)).toEqual(full)
  })

  it('ne produit pas de doublons quand existingEntries contient tous les codes', () => {
    const result = buildRaceOrder(['VER', 'LEC', 'NOR', 'HAM', 'RUS'], allCodes)
    expect(new Set(result).size).toBe(result.length)
    expect(result).toHaveLength(allCodes.length)
  })

  it('gère une liste allCodes vide', () => {
    expect(buildRaceOrder([], [])).toEqual([])
  })
})

describe('buildPrefilledRaceOrder', () => {
  const allCodes = ['VER', 'LEC', 'NOR', 'HAM', 'RUS']
  const expectedCount = allCodes.length

  it('un prono enregistré est prioritaire — la grille est ignorée', () => {
    expect(buildPrefilledRaceOrder(['NOR', 'LEC'], ['HAM', 'VER', 'RUS'], allCodes, expectedCount))
      .toEqual(['NOR', 'LEC', 'VER', 'HAM', 'RUS'])
  })

  it("sans prono, pré-remplit dans l'ordre de la grille", () => {
    expect(buildPrefilledRaceOrder([], ['HAM', 'RUS', 'VER', 'NOR', 'LEC'], allCodes, expectedCount))
      .toEqual(['HAM', 'RUS', 'VER', 'NOR', 'LEC'])
  })

  it('filtre les codes de la grille inconnus et ajoute les pilotes hors grille à la fin', () => {
    // 'XXX' inconnu de allCodes → filtré ; LEC et RUS absents de la grille → ajoutés en fin.
    expect(buildPrefilledRaceOrder([], ['HAM', 'XXX', 'VER', 'NOR'], allCodes, expectedCount))
      .toEqual(['HAM', 'VER', 'NOR', 'LEC', 'RUS'])
  })

  it('sans prono ni grille, retombe sur le comportement historique (allCodes)', () => {
    expect(buildPrefilledRaceOrder([], [], allCodes, expectedCount)).toEqual(allCodes)
  })

  it('ne produit pas de doublons quand un pilote figure dans la grille et allCodes', () => {
    const result = buildPrefilledRaceOrder([], ['NOR', 'VER'], allCodes, expectedCount)
    expect(new Set(result).size).toBe(result.length)
    expect(result).toHaveLength(allCodes.length)
  })

  // Cap à expectedCount : liste saison > partants (échange de baquet — cas
  // Zandvoort 2026 : 23 pilotes saison pour 22 partants). Sans le cap, le
  // formulaire envoyait toute la liste et le serveur rejetait (tooManyDrivers).
  describe('liste saison plus longue que le nombre de partants', () => {
    // ABS = pilote badgé absent, relégué en fin de liste par la page.
    const withAbsent = [...allCodes, 'ABS']
    const grid = ['HAM', 'RUS', 'VER', 'NOR', 'LEC']

    it('plafonne à expectedCount — le pilote en fin de liste (absent) est exclu', () => {
      const order = buildPrefilledRaceOrder([], grid, withAbsent, expectedCount)
      expect(order).toHaveLength(expectedCount)
      expect(order).not.toContain('ABS')
    })

    it('sans grille : ordre fourni plafonné, absent exclu', () => {
      expect(buildPrefilledRaceOrder([], [], withAbsent, expectedCount)).toEqual(allCodes)
    })

    it("un prono d'avant l'échange (contenant l'absent) est conservé, le remplaçant coupé", () => {
      // Prono historique : ABS classé, RUS (remplaçant tardif) inconnu à l'époque.
      const existing = ['ABS', 'VER', 'LEC', 'NOR', 'HAM']
      const order = buildPrefilledRaceOrder(existing, grid, withAbsent, expectedCount)
      expect(order).toEqual(existing)
      expect(order).not.toContain('RUS')
    })
  })
})

describe('buildPrefilledTopEntries', () => {
  const allCodes = ['VER', 'LEC', 'NOR', 'HAM', 'RUS']

  it('un prono enregistré est prioritaire — la grille est ignorée', () => {
    expect(buildPrefilledTopEntries(['RUS'], ['HAM', 'VER'], allCodes, 3)).toEqual(['RUS'])
  })

  it('sans prono, pré-sélectionne les N premiers de la grille', () => {
    expect(buildPrefilledTopEntries([], ['HAM', 'RUS', 'VER', 'NOR', 'LEC'], allCodes, 3))
      .toEqual(['HAM', 'RUS', 'VER'])
  })

  it('filtre les codes inconnus AVANT la troncature au top N', () => {
    expect(buildPrefilledTopEntries([], ['XXX', 'HAM', 'RUS', 'VER'], allCodes, 3))
      .toEqual(['HAM', 'RUS', 'VER'])
  })

  it('grille plus courte que N → sélection partielle', () => {
    expect(buildPrefilledTopEntries([], ['HAM'], allCodes, 3)).toEqual(['HAM'])
  })

  it('sans prono ni grille, retombe sur une sélection vide (comportement historique)', () => {
    expect(buildPrefilledTopEntries([], [], allCodes, 3)).toEqual([])
  })
})

describe('isGridPrefilled', () => {
  it('vrai uniquement sans prono enregistré ET avec une grille connue', () => {
    expect(isGridPrefilled([], ['VER'])).toBe(true)
    expect(isGridPrefilled(['VER'], ['VER'])).toBe(false)
    expect(isGridPrefilled([], [])).toBe(false)
  })
})
