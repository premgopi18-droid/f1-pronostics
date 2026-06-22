import { describe, it, expect, vi, beforeEach } from 'vitest'

// Cookie store mockable
const cookieGet = vi.fn()
const cookieDelete = vi.fn()
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: cookieGet, delete: cookieDelete }),
}))

// Join + saison mockés (on teste le contrat, pas la DB)
const joinLeagueByCode = vi.fn()
vi.mock('@/lib/data/leagues', () => ({
  joinLeagueByCode: (...args: unknown[]) => joinLeagueByCode(...args),
}))
vi.mock('@/lib/api/cron', () => ({ getCurrentSeason: () => 2026 }))

import { consumePendingInvite } from './invites'
import { PENDING_INVITE_COOKIE } from '@/lib/invites'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('consumePendingInvite', () => {
  it('sans cookie : renvoie null, ne touche ni au join ni au cookie', async () => {
    cookieGet.mockReturnValue(undefined)
    expect(await consumePendingInvite('u1')).toBeNull()
    expect(joinLeagueByCode).not.toHaveBeenCalled()
    expect(cookieDelete).not.toHaveBeenCalled()
  })

  it('succès : auto-join, code normalisé en majuscules, cookie effacé', async () => {
    cookieGet.mockReturnValue({ value: '  abcd1234  ' })
    joinLeagueByCode.mockResolvedValue({ leagueId: 'L1' })

    expect(await consumePendingInvite('u1')).toBe('L1')
    expect(joinLeagueByCode).toHaveBeenCalledWith('u1', 'ABCD1234', 2026)
    expect(cookieDelete).toHaveBeenCalledWith(PENDING_INVITE_COOKIE)
  })

  it('fail-safe : une erreur de join → null, cookie tout de même effacé', async () => {
    cookieGet.mockReturnValue({ value: 'ABCD1234' })
    joinLeagueByCode.mockRejectedValue(new Error('Ligue pleine'))

    expect(await consumePendingInvite('u1')).toBeNull()
    expect(cookieDelete).toHaveBeenCalledWith(PENDING_INVITE_COOKIE)
  })
})
