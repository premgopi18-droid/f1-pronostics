import { afterEach, describe, expect, it, vi } from 'vitest'
import { isIOSSafari } from './use-install-prompt'

// isIOSSafari lit navigator.userAgent / maxTouchPoints. L'env vitest est `node` (pas de
// navigator), on le stubbe donc par cas. Cf. detection : iPhone/iPad/iPod, iPadOS 13+ qui se
// présente en « Macintosh » + tactile, et exclusion des navigateurs iOS non-Safari.
function stubNavigator(userAgent: string, maxTouchPoints = 0) {
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isIOSSafari', () => {
  it('reconnaît Safari iPhone', () => {
    stubNavigator(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1',
      5,
    )
    expect(isIOSSafari()).toBe(true)
  })

  it('reconnaît un iPad iPadOS 13+ (UA « Macintosh » + tactile)', () => {
    stubNavigator(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
      5,
    )
    expect(isIOSSafari()).toBe(true)
  })

  it('exclut un Mac desktop (Macintosh sans tactile)', () => {
    stubNavigator(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
      0,
    )
    expect(isIOSSafari()).toBe(false)
  })

  it('exclut Chrome iOS (CriOS)', () => {
    stubNavigator(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/112.0.5615.70 Mobile/15E148 Safari/604.1',
      5,
    )
    expect(isIOSSafari()).toBe(false)
  })

  it('exclut Firefox iOS (FxiOS)', () => {
    stubNavigator(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/112.0 Mobile/15E148 Safari/605.1',
      5,
    )
    expect(isIOSSafari()).toBe(false)
  })

  it('exclut Android Chrome', () => {
    stubNavigator(
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
      5,
    )
    expect(isIOSSafari()).toBe(false)
  })

  it('exclut Chrome desktop (Windows)', () => {
    stubNavigator(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
      0,
    )
    expect(isIOSSafari()).toBe(false)
  })
})
