import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getSplashSoundEnabled,
  setSplashSoundEnabled,
  SPLASH_SOUND_STORAGE_KEY,
} from './splash-sound'

// L'env vitest est `node` : pas de localStorage/window. On stubbe un localStorage
// minimal et un window porteur de dispatchEvent pour couvrir la logique opt-out.
function stubBrowser() {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  })
  vi.stubGlobal('window', { dispatchEvent: vi.fn() })
}

beforeEach(stubBrowser)
afterEach(() => vi.unstubAllGlobals())

describe('préférence son du splash', () => {
  it('est activée par défaut quand aucune valeur n’est stockée (opt-out)', () => {
    expect(getSplashSoundEnabled()).toBe(true)
  })

  it('reste activée pour toute valeur autre que la chaîne "false"', () => {
    localStorage.setItem(SPLASH_SOUND_STORAGE_KEY, 'true')
    expect(getSplashSoundEnabled()).toBe(true)
  })

  it('se désactive uniquement sur la valeur "false"', () => {
    setSplashSoundEnabled(false)
    expect(localStorage.getItem(SPLASH_SOUND_STORAGE_KEY)).toBe('false')
    expect(getSplashSoundEnabled()).toBe(false)
  })

  it('peut être réactivée après désactivation', () => {
    setSplashSoundEnabled(false)
    setSplashSoundEnabled(true)
    expect(getSplashSoundEnabled()).toBe(true)
  })

  it('notifie le même onglet via un event à chaque écriture', () => {
    setSplashSoundEnabled(false)
    expect(window.dispatchEvent).toHaveBeenCalledOnce()
  })
})
