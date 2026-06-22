import { describe, it, expect } from 'vitest'
import { buildTabLabel } from '@/lib/predictions/helpers'

describe('buildTabLabel', () => {
  it('affiche le checkmark quand la session a une prédiction sauvegardée', () => {
    expect(buildTabLabel('Qualifs', true, false)).toBe('✓ Qualifs')
  })

  it("affiche le bullet quand l'onglet est actif sans prédiction", () => {
    expect(buildTabLabel('Course', false, true)).toBe('• Course')
  })

  it('affiche le label brut quand inactif et sans prédiction', () => {
    expect(buildTabLabel('Course', false, false)).toBe('Course')
  })

  it('le checkmark a priorité sur le bullet (onglet actif + sauvegardé)', () => {
    expect(buildTabLabel('Qualifs', true, true)).toBe('✓ Qualifs')
  })

  it('fonctionne pour tous les types de session', () => {
    expect(buildTabLabel('Sprint Qualifs', false, true)).toBe('• Sprint Qualifs')
    expect(buildTabLabel('Sprint', true, false)).toBe('✓ Sprint')
  })
})
