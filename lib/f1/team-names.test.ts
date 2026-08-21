import { describe, it, expect, vi, afterEach } from 'vitest'
import { constructorCodeFromOpenF1TeamName } from './team-names'

describe('constructorCodeFromOpenF1TeamName', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mappe les libellés OpenF1 2026 vers les codes constructeurs internes', () => {
    // Les deux cas piégeux du GP Pays-Bas 2026 (échange de baquet) :
    expect(constructorCodeFromOpenF1TeamName('Red Bull Racing')).toBe('RED_BULL')
    expect(constructorCodeFromOpenF1TeamName('Racing Bulls')).toBe('RB')
    // Libellé OpenF1 ≠ nom Jolpica :
    expect(constructorCodeFromOpenF1TeamName('Haas F1 Team')).toBe('HAAS')
    expect(constructorCodeFromOpenF1TeamName('Mercedes')).toBe('MERCEDES')
  })

  it('libellé inconnu → null + warning (jamais de crash, fallback mapping saison)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(constructorCodeFromOpenF1TeamName('Andretti Global')).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
  })
})
