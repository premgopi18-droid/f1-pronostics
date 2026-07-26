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

  it('un prono enregistré est prioritaire — la grille est ignorée', () => {
    expect(buildPrefilledRaceOrder(['NOR', 'LEC'], ['HAM', 'VER', 'RUS'], allCodes))
      .toEqual(['NOR', 'LEC', 'VER', 'HAM', 'RUS'])
  })

  it("sans prono, pré-remplit dans l'ordre de la grille", () => {
    expect(buildPrefilledRaceOrder([], ['HAM', 'RUS', 'VER', 'NOR', 'LEC'], allCodes))
      .toEqual(['HAM', 'RUS', 'VER', 'NOR', 'LEC'])
  })

  it('filtre les codes de la grille inconnus et ajoute les pilotes hors grille à la fin', () => {
    // 'XXX' inconnu de allCodes → filtré ; LEC et RUS absents de la grille → ajoutés en fin.
    expect(buildPrefilledRaceOrder([], ['HAM', 'XXX', 'VER', 'NOR'], allCodes))
      .toEqual(['HAM', 'VER', 'NOR', 'LEC', 'RUS'])
  })

  it('sans prono ni grille, retombe sur le comportement historique (allCodes)', () => {
    expect(buildPrefilledRaceOrder([], [], allCodes)).toEqual(allCodes)
  })

  it('ne produit pas de doublons quand un pilote figure dans la grille et allCodes', () => {
    const result = buildPrefilledRaceOrder([], ['NOR', 'VER'], allCodes)
    expect(new Set(result).size).toBe(result.length)
    expect(result).toHaveLength(allCodes.length)
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
