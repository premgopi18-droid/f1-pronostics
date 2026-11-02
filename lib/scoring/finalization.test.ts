import { describe, it, expect } from 'vitest'
import {
  RACE_CONFIRMATION_REVISION_DELAY_MS,
  RESULTS_REVISION_FREEZE_MS,
  finalizationDeadline,
  isGPReadyToFinalize,
  isResultsRevisionOpen,
  nextLocalHourAfter,
} from './finalization'

const HOUR_MS = 60 * 60 * 1000
const at = (iso: string) => new Date(iso).getTime()

describe('nextLocalHourAfter', () => {
  it('lendemain 8 h à Paris, en heure d\'hiver (UTC+1)', () => {
    expect(nextLocalHourAfter(at('2026-11-01T20:00:00Z'), 'Europe/Paris', 8)).toBe(at('2026-11-02T07:00:00Z'))
  })

  it('en heure d\'été (UTC+2)', () => {
    expect(nextLocalHourAfter(at('2026-07-05T13:00:00Z'), 'Europe/Paris', 8)).toBe(at('2026-07-06T06:00:00Z'))
  })

  it('même jour si 8 h n\'est pas encore passé à Paris', () => {
    expect(nextLocalHourAfter(at('2026-03-29T03:00:00Z'), 'Europe/Paris', 8)).toBe(at('2026-03-29T06:00:00Z'))
  })

  // Nuit du passage à l'heure d'été (29/03/2026, 2 h → 3 h) : le décalage du
  // jour visé n'est pas celui de l'instant de départ.
  it('à travers un changement d\'heure', () => {
    expect(nextLocalHourAfter(at('2026-03-28T22:00:00Z'), 'Europe/Paris', 8)).toBe(at('2026-03-29T06:00:00Z'))
  })
})

describe('finalizationDeadline', () => {
  // GP du Mexique 2026 : départ dimanche 20:00 UTC (21 h Paris) → H+12 = lundi
  // 08:00 UTC, après le 8 h Paris (07:00 UTC) → H+12 l'emporte.
  it('course du soir : 12 h après le départ', () => {
    expect(finalizationDeadline('2026-11-01T20:00:00Z', '2026-11-01T22:30:00Z')).toBe(at('2026-11-02T08:00:00Z'))
  })

  // Course européenne : départ 13:00 UTC → H+12 = 01:00 UTC, en pleine nuit →
  // reportée au lendemain 8 h Paris (pas de push à 3 h du matin).
  it('course européenne : échéance nocturne reportée à 8 h Paris', () => {
    expect(finalizationDeadline('2026-11-08T13:00:00Z', '2026-11-08T15:30:00Z')).toBe(at('2026-11-09T07:00:00Z'))
  })

  // Course matinale (Australie, départ 06 h Paris) : H+12 tombe en soirée, pas
  // la nuit → aucun report, définitifs le dimanche soir.
  it('course matinale : H+12 en soirée, pas de report', () => {
    expect(finalizationDeadline('2026-03-08T04:00:00Z', '2026-03-08T06:00:00Z')).toBe(at('2026-03-08T16:00:00Z'))
  })

  // Jolpica qui confirme lundi 22:00 UTC : + 3 h = 01:00 UTC mardi, la nuit →
  // reportée à 8 h Paris, jamais de push nocturne même dans ce cas.
  it('confirmation très tardive : échéance nocturne reportée à 8 h Paris', () => {
    expect(finalizationDeadline('2026-11-08T13:00:00Z', '2026-11-09T22:00:00Z')).toBe(at('2026-11-10T07:00:00Z'))
  })

  // Jolpica a déjà publié 10 à 14 h après le départ : la course doit pouvoir
  // être révisée après sa confirmation, avant d'être finalisée.
  it('confirmation tardive de la course : la finalisation recule d\'autant', () => {
    expect(finalizationDeadline('2026-11-01T20:00:00Z', '2026-11-02T09:00:00Z'))
      .toBe(at('2026-11-02T09:00:00Z') + RACE_CONFIRMATION_REVISION_DELAY_MS)
  })
})

describe('isGPReadyToFinalize', () => {
  it('jamais tant que la course n\'est pas confirmée', () => {
    expect(isGPReadyToFinalize('2026-11-01T20:00:00Z', null, at('2026-11-05T00:00:00Z'))).toBe(false)
  })

  it('pas avant l\'échéance, oui à l\'échéance', () => {
    expect(isGPReadyToFinalize('2026-11-01T20:00:00Z', '2026-11-01T22:30:00Z', at('2026-11-02T07:59:59Z'))).toBe(false)
    expect(isGPReadyToFinalize('2026-11-01T20:00:00Z', '2026-11-01T22:30:00Z', at('2026-11-02T08:00:00Z'))).toBe(true)
  })
})

describe('isResultsRevisionOpen', () => {
  it('ouverte pour les qualifs du samedi, course pas encore confirmée', () => {
    expect(isResultsRevisionOpen('2026-11-01T20:00:00Z', null, at('2026-10-31T23:30:00Z'))).toBe(true)
  })

  it('ouverte pendant la nuit qui suit la course', () => {
    expect(isResultsRevisionOpen('2026-11-01T20:00:00Z', '2026-11-01T22:30:00Z', at('2026-11-02T03:00:00Z'))).toBe(true)
  })

  // Les deux crons ne se coordonnent pas : une révision ne doit jamais
  // supprimer des scores pendant que le trigger finalise.
  it('fermée avant que la finalisation ne devienne possible (marge de gel)', () => {
    const deadline = finalizationDeadline('2026-11-01T20:00:00Z', '2026-11-01T22:30:00Z')
    expect(isResultsRevisionOpen('2026-11-01T20:00:00Z', '2026-11-01T22:30:00Z', deadline - RESULTS_REVISION_FREEZE_MS - 1)).toBe(true)
    expect(isResultsRevisionOpen('2026-11-01T20:00:00Z', '2026-11-01T22:30:00Z', deadline - RESULTS_REVISION_FREEZE_MS)).toBe(false)
    expect(isResultsRevisionOpen('2026-11-01T20:00:00Z', '2026-11-01T22:30:00Z', deadline)).toBe(false)
  })

  it('confirmation tardive : encore ouverte juste après la confirmation', () => {
    expect(isResultsRevisionOpen('2026-11-01T20:00:00Z', '2026-11-02T09:00:00Z', at('2026-11-02T09:10:00Z'))).toBe(true)
    expect(isResultsRevisionOpen('2026-11-01T20:00:00Z', '2026-11-02T09:00:00Z', at('2026-11-02T09:00:00Z') + 2 * HOUR_MS)).toBe(false)
  })
})
