import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFontSizeOption, setFontSizeOption } from './use-font-size'
import { FONT_SIZE_STORAGE_KEY } from '@/lib/a11y/font-size'

// L'env vitest est `node` : pas de localStorage/window/document. On stubbe le strict
// nécessaire pour couvrir la résolution de préférence + l'application de la classe sur <html>.
let appliedClasses: Set<string>

function stubBrowser() {
  const store = new Map<string, string>()
  appliedClasses = new Set<string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  })
  vi.stubGlobal('document', {
    documentElement: {
      classList: {
        add: (cls: string) => void appliedClasses.add(cls),
        remove: (cls: string) => void appliedClasses.delete(cls),
        contains: (cls: string) => appliedClasses.has(cls),
      },
    },
  })
  vi.stubGlobal('window', { dispatchEvent: vi.fn() })
}

beforeEach(stubBrowser)
afterEach(() => vi.unstubAllGlobals())

describe('getFontSizeOption', () => {
  it('retourne "normal" quand aucune valeur n’est stockée', () => {
    expect(getFontSizeOption()).toBe('normal')
  })

  it('retourne la valeur stockée quand elle est valide', () => {
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, 'large')
    expect(getFontSizeOption()).toBe('large')
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, 'xlarge')
    expect(getFontSizeOption()).toBe('xlarge')
  })

  it('retombe sur "normal" pour une valeur inconnue (donnée corrompue / legacy)', () => {
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, 'gigantic')
    expect(getFontSizeOption()).toBe('normal')
  })
})

describe('setFontSizeOption', () => {
  it('persiste le choix et notifie le même onglet via un event', () => {
    setFontSizeOption('large')
    expect(localStorage.getItem(FONT_SIZE_STORAGE_KEY)).toBe('large')
    expect(window.dispatchEvent).toHaveBeenCalledOnce()
  })

  it('pose la classe correspondante sur <html>', () => {
    setFontSizeOption('large')
    expect(document.documentElement.classList.contains('font-size-lg')).toBe(true)
    setFontSizeOption('xlarge')
    expect(document.documentElement.classList.contains('font-size-xl')).toBe(true)
  })

  it('remplace l’ancienne classe au lieu de les cumuler', () => {
    setFontSizeOption('large')
    setFontSizeOption('xlarge')
    expect(document.documentElement.classList.contains('font-size-lg')).toBe(false)
    expect(document.documentElement.classList.contains('font-size-xl')).toBe(true)
  })

  it('ne pose aucune classe pour "normal" (sentinelle chaîne vide) et retire la précédente', () => {
    setFontSizeOption('xlarge')
    setFontSizeOption('normal')
    expect(document.documentElement.classList.contains('font-size-xl')).toBe(false)
    expect(appliedClasses.size).toBe(0)
  })
})
