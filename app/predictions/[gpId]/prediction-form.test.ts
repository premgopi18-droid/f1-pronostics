import { describe, it, expect } from 'vitest'
import { buildRaceOrder } from '@/lib/predictions/helpers'

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
