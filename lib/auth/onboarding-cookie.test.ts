import { describe, it, expect } from 'vitest'
import { isOnboardedCookieValid } from './onboarding-cookie'

describe('isOnboardedCookieValid', () => {
  it('valide uniquement quand le cookie désigne l\'utilisateur courant', () => {
    expect(isOnboardedCookieValid('user-1', 'user-1')).toBe(true)
  })

  it('invalide sans cookie, cookie vide ou autre utilisateur (changement de compte)', () => {
    expect(isOnboardedCookieValid(undefined, 'user-1')).toBe(false)
    expect(isOnboardedCookieValid('', 'user-1')).toBe(false)
    expect(isOnboardedCookieValid('user-2', 'user-1')).toBe(false)
  })
})
