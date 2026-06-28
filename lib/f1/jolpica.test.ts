import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchCalendar,
  fetchDriverStandings,
  fetchConstructorStandings,
  mapRaceResult,
  type JolpikaRaceResult,
} from './jolpica'

// Fixture minimale Jolpica /2025/races — un GP classique + un GP sprint weekend
const JOLPIKA_RACES_RESPONSE = {
  MRData: {
    RaceTable: {
      Races: [
        {
          season: '2025',
          round:  '1',
          raceName: 'Bahrain Grand Prix',
          Circuit: {
            circuitName: 'Bahrain International Circuit',
            Location: { country: 'Bahrain', locality: 'Sakhir' },
          },
          date: '2025-03-16',
          time: '15:00:00Z',
          FirstPractice:    { date: '2025-03-14', time: '11:30:00Z' },
          Qualifying:       { date: '2025-03-15', time: '15:00:00Z' },
          // pas de Sprint ni SprintQualifying → GP classique
        },
        {
          season: '2025',
          round:  '6',
          raceName: 'Chinese Grand Prix',
          Circuit: {
            circuitName: 'Shanghai International Circuit',
            Location: { country: 'China', locality: 'Shanghai' },
          },
          date: '2025-03-23',
          time: '07:00:00Z',
          FirstPractice:    { date: '2025-03-21', time: '03:30:00Z' },
          Qualifying:       { date: '2025-03-22', time: '07:00:00Z' },
          SprintQualifying: { date: '2025-03-22', time: '03:00:00Z' },
          Sprint:           { date: '2025-03-22', time: '07:00:00Z' },
        },
      ],
    },
  },
}

// GP sans Qualifying ni FP1 — tombe dans les deux fallbacks
const JOLPIKA_NO_SCHEDULE = {
  MRData: {
    RaceTable: {
      Races: [
        {
          season: '2025',
          round:  '99',
          raceName: 'Test Grand Prix',
          Circuit: {
            circuitName: 'Test Circuit',
            Location: { country: 'Testland', locality: 'Testville' },
          },
          date: '2025-12-01',
          time: '14:00:00Z',
          // ni FirstPractice, ni Qualifying, ni Sprint
        },
      ],
    },
  },
}

describe('fetchCalendar', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function mockFetch(body: unknown) {
    vi.mocked(fetch).mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve(body),
    } as Response)
  }

  describe('GP classique (Bahrain)', () => {
    it('mappe les champs de base', async () => {
      mockFetch(JOLPIKA_RACES_RESPONSE)
      const entries = await fetchCalendar(2025)
      const bahrain = entries[0]

      expect(bahrain.season).toBe(2025)
      expect(bahrain.round).toBe(1)
      expect(bahrain.name).toBe('Bahrain Grand Prix')
      expect(bahrain.circuit).toBe('Bahrain International Circuit')
      expect(bahrain.country).toBe('Bahrain')
    })

    it('isSprintWeekend = false quand pas de Sprint', async () => {
      mockFetch(JOLPIKA_RACES_RESPONSE)
      const [bahrain] = await fetchCalendar(2025)
      expect(bahrain.isSprintWeekend).toBe(false)
    })

    it('sprintRaceStartsAt et sprintQualStartsAt sont null', async () => {
      mockFetch(JOLPIKA_RACES_RESPONSE)
      const [bahrain] = await fetchCalendar(2025)
      expect(bahrain.sprintRaceStartsAt).toBeNull()
      expect(bahrain.sprintQualStartsAt).toBeNull()
    })

    it('weekendStartsAt = début des qualifs (hors essais) en week-end normal', async () => {
      mockFetch(JOLPIKA_RACES_RESPONSE)
      const [bahrain] = await fetchCalendar(2025)
      expect(bahrain.weekendStartsAt).toBe('2025-03-15T15:00:00Z')
    })

    it('qualifyingStartsAt depuis Qualifying Jolpika', async () => {
      mockFetch(JOLPIKA_RACES_RESPONSE)
      const [bahrain] = await fetchCalendar(2025)
      expect(bahrain.qualifyingStartsAt).toBe('2025-03-15T15:00:00Z')
    })

    it('raceStartsAt depuis date+time course', async () => {
      mockFetch(JOLPIKA_RACES_RESPONSE)
      const [bahrain] = await fetchCalendar(2025)
      expect(bahrain.raceStartsAt).toBe('2025-03-16T15:00:00Z')
    })
  })

  describe('Sprint weekend (Chine)', () => {
    it('isSprintWeekend = true', async () => {
      mockFetch(JOLPIKA_RACES_RESPONSE)
      const [, china] = await fetchCalendar(2025)
      expect(china.isSprintWeekend).toBe(true)
    })

    it('sprintRaceStartsAt et sprintQualStartsAt renseignés', async () => {
      mockFetch(JOLPIKA_RACES_RESPONSE)
      const [, china] = await fetchCalendar(2025)
      expect(china.sprintRaceStartsAt).toBe('2025-03-22T07:00:00Z')
      expect(china.sprintQualStartsAt).toBe('2025-03-22T03:00:00Z')
    })

    it('weekendStartsAt = début de la sprint qualif en week-end sprint', async () => {
      mockFetch(JOLPIKA_RACES_RESPONSE)
      const [, china] = await fetchCalendar(2025)
      expect(china.weekendStartsAt).toBe('2025-03-22T03:00:00Z')
    })
  })

  describe('Fallbacks sans horaires Jolpica', () => {
    it('weekendStartsAt = date+time course si pas de qualif (fallback)', async () => {
      mockFetch(JOLPIKA_NO_SCHEDULE)
      const [entry] = await fetchCalendar(2025)
      expect(entry.weekendStartsAt).toBe('2025-12-01T14:00:00Z')
    })

    it('qualifyingStartsAt = date+time course si pas de Qualifying', async () => {
      mockFetch(JOLPIKA_NO_SCHEDULE)
      const [entry] = await fetchCalendar(2025)
      expect(entry.qualifyingStartsAt).toBe('2025-12-01T14:00:00Z')
    })

    it('time manquant → 00:00:00Z', async () => {
      const noTime = structuredClone(JOLPIKA_NO_SCHEDULE)
      delete (noTime.MRData.RaceTable.Races[0] as Record<string, unknown>).time
      mockFetch(noTime)
      const [entry] = await fetchCalendar(2025)
      expect(entry.raceStartsAt).toBe('2025-12-01T00:00:00Z')
    })
  })
})

describe('fetchDriverStandings', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  function mockFetch(body: unknown) {
    vi.mocked(fetch).mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve(body),
    } as Response)
  }

  it('mappe code pilote → position', async () => {
    mockFetch({
      MRData: { StandingsTable: { StandingsLists: [{ DriverStandings: [
        { position: '1', Driver: { code: 'VER' } },
        { position: '2', Driver: { code: 'NOR' } },
      ] }] } },
    })
    const standings = await fetchDriverStandings(2025)
    expect(standings.get('VER')).toBe(1)
    expect(standings.get('NOR')).toBe(2)
    expect(standings.size).toBe(2)
  })

  it('StandingsLists vide → Map vide (pas de throw)', async () => {
    mockFetch({ MRData: { StandingsTable: { StandingsLists: [] } } })
    const standings = await fetchDriverStandings(2025)
    expect(standings.size).toBe(0)
  })
})

describe('fetchConstructorStandings', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  function mockFetch(body: unknown) {
    vi.mocked(fetch).mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve(body),
    } as Response)
  }

  it('mappe constructorId normalisé (toConstructorCode) → position', async () => {
    mockFetch({
      MRData: { StandingsTable: { StandingsLists: [{ ConstructorStandings: [
        { position: '1', Constructor: { constructorId: 'red_bull' } },
        { position: '2', Constructor: { constructorId: 'mclaren' } },
      ] }] } },
    })
    const standings = await fetchConstructorStandings(2025)
    expect(standings.get('RED_BULL')).toBe(1)
    expect(standings.get('MCLAREN')).toBe(2)
    expect(standings.size).toBe(2)
  })

  it('StandingsLists vide → Map vide (pas de throw)', async () => {
    mockFetch({ MRData: { StandingsTable: { StandingsLists: [] } } })
    const standings = await fetchConstructorStandings(2025)
    expect(standings.size).toBe(0)
  })
})

describe('mapRaceResult', () => {
  // Construit un résultat Jolpica minimal-mais-complet pour le mapper.
  // `position` est le classement officiel (toujours numérique chez Ergast/Jolpica,
  // abandons inclus) ; `positionText` porte le statut ("R" = abandon).
  function makeResult(
    code: string,
    position: string,
    positionText: string,
    fastestLapRank?: string,
  ): JolpikaRaceResult {
    return {
      position,
      positionText,
      Driver: {
        code,
        driverId:        code.toLowerCase(),
        givenName:       'Test',
        familyName:      'Driver',
        permanentNumber: '99',
      },
      ...(fastestLapRank ? { FastestLap: { rank: fastestLapRank } } : {}),
    }
  }

  it('utilise `position` (numérique) et non `positionText` pour un pilote classé', () => {
    const [code, result] = mapRaceResult(makeResult('VER', '1', '1'))
    expect(code).toBe('VER')
    expect(result.position).toBe(1)
    expect(result.dnf).toBe(false)
  })

  // Régression : un DNF a `positionText: "R"` mais garde un `position` numérique
  // (son rang de classement). L'ancien code lisait positionText → position null,
  // et les abandons disparaissaient du scoring.
  it('mappe un DNF sur sa position classée + dnf=true', () => {
    const [, result] = mapRaceResult(makeResult('OCO', '18', 'R'))
    expect(result.position).toBe(18)
    expect(result.dnf).toBe(true)
  })

  // Un pilote forfait avant le départ a `positionText: "W"` (Withdrew) — distinct
  // d'un abandon en course ("R"). On le marque dns=true / dnf=false pour que l'UI
  // affiche un badge DNS dédié et que le pari dnf_prediction ne se déclenche pas.
  it('mappe un DNS (positionText "W") sur dns=true / dnf=false', () => {
    const [, result] = mapRaceResult(makeResult('STR', '20', 'W'))
    expect(result.dns).toBe(true)
    expect(result.dnf).toBe(false)
  })

  it('détecte le tour le plus rapide (FastestLap.rank === "1")', () => {
    const [, withFl]    = mapRaceResult(makeResult('NOR', '3', '3', '1'))
    const [, withoutFl] = mapRaceResult(makeResult('LEC', '2', '2', '5'))
    expect(withFl.fastestLap).toBe(true)
    expect(withoutFl.fastestLap).toBe(false)
  })
})
