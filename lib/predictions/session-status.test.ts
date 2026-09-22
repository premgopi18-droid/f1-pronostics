import { describe, it, expect } from 'vitest'
import { deriveGpSessionStatuses } from './session-status'

const NOW = new Date('2026-09-26T13:00:00Z').getTime()

const qualifying = { id: 'q', type: 'qualifying' as const, startsAt: '2026-09-26T12:00:00Z' }
const race       = { id: 'r', type: 'race' as const,       startsAt: '2026-09-27T13:00:00Z' }

describe('deriveGpSessionStatuses', () => {
  it('aucune session → tableau vide', () => {
    expect(deriveGpSessionStatuses([], new Set(), NOW)).toEqual([])
  })

  it('verrouille les sessions commencées et marque les soumissions', () => {
    const views = deriveGpSessionStatuses([qualifying, race], new Set(['q']), NOW)
    expect(views).toEqual([
      { type: 'qualifying', lockState: 'locked', hasSubmitted: true,  startsAt: qualifying.startsAt },
      { type: 'race',       lockState: 'open',   hasSubmitted: false, startsAt: race.startsAt },
    ])
  })

  it('ignore les soumissions sur des sessions hors du GP', () => {
    const views = deriveGpSessionStatuses([race], new Set(['autre-gp']), NOW)
    expect(views[0].hasSubmitted).toBe(false)
  })

  it('préserve l\'ordre des sessions fourni', () => {
    const views = deriveGpSessionStatuses([race, qualifying], new Set(), NOW)
    expect(views.map((v) => v.type)).toEqual(['race', 'qualifying'])
  })
})
