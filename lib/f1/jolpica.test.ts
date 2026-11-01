import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchCalendar,
  fetchDriverStandings,
  fetchConstructorStandings,
  fetchRaceLaps,
  fetchQualifyingResults,
  fetchDrivers,
  mapRaceResult,
  resolveResultDriverCode,
  buildDriverCodeByNumber,
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
    const result = mapRaceResult(makeResult('VER', '1', '1'))
    expect(result.position).toBe(1)
    expect(result.dnf).toBe(false)
  })

  // Régression : un DNF a `positionText: "R"` mais garde un `position` numérique
  // (son rang de classement). L'ancien code lisait positionText → position null,
  // et les abandons disparaissaient du scoring.
  it('mappe un DNF sur sa position classée + dnf=true', () => {
    const result = mapRaceResult(makeResult('OCO', '18', 'R'))
    expect(result.position).toBe(18)
    expect(result.dnf).toBe(true)
  })

  // Un pilote forfait avant le départ a `positionText: "W"` (Withdrew) — distinct
  // d'un abandon en course ("R"). On le marque dns=true / dnf=false pour que l'UI
  // affiche un badge DNS dédié et que le pari dnf_prediction ne se déclenche pas.
  it('mappe un DNS (positionText "W") sur dns=true / dnf=false', () => {
    const result = mapRaceResult(makeResult('STR', '20', 'W'))
    expect(result.dns).toBe(true)
    expect(result.dnf).toBe(false)
  })

  it('détecte le tour le plus rapide (FastestLap.rank === "1")', () => {
    const withFl    = mapRaceResult(makeResult('NOR', '3', '3', '1'))
    const withoutFl = mapRaceResult(makeResult('LEC', '2', '2', '5'))
    expect(withFl.fastestLap).toBe(true)
    expect(withoutFl.fastestLap).toBe(false)
  })

  // #205 — l'écurie de CETTE course est portée par chaque ligne de résultat Jolpica,
  // normalisée avec la même règle que fetchConstructors ("red_bull" → "RED_BULL").
  it('normalise Constructor.constructorId en constructorCode', () => {
    const result = mapRaceResult({
      ...makeResult('LAW', '9', '9'),
      Constructor: { constructorId: 'red_bull', name: 'Red Bull' },
    })
    expect(result.constructorCode).toBe('RED_BULL')
  })

  it('constructorCode null si Jolpica omet Constructor', () => {
    const result = mapRaceResult(makeResult('VER', '1', '1'))
    expect(result.constructorCode).toBeNull()
  })
})

// #255 — GP du Mexique 2026 : Hirakawa (remplaçant d'Ocon) classé par Jolpica
// avec son numéro de voiture mais SANS trigramme.
const HIRAKAWA_DRIVER = { driverId: 'ryo_hirakawa', givenName: 'Ryo', familyName: 'Hirakawa' }

describe('buildDriverCodeByNumber', () => {
  it('indexe les pilotes par numéro, ignore ceux sans numéro', () => {
    const codeByNumber = buildDriverCodeByNumber([
      { code: 'BEA', number: 87 },
      { code: 'HIR', number: 50 },
      { code: 'XXX', number: null },
    ])
    expect(codeByNumber.get(50)).toBe('HIR')
    expect(codeByNumber.get(87)).toBe('BEA')
    expect(codeByNumber.size).toBe(2)
  })

  it('exclut un numéro porté par plusieurs pilotes plutôt que de deviner', () => {
    const codeByNumber = buildDriverCodeByNumber([
      { code: 'AAA', number: 7 },
      { code: 'BBB', number: 7 },
      { code: 'CCC', number: 8 },
    ])
    expect(codeByNumber.has(7)).toBe(false)
    expect(codeByNumber.get(8)).toBe('CCC')
  })
})

describe('resolveResultDriverCode', () => {
  const codeByNumber = new Map([[50, 'HIR']])

  it('le trigramme Jolpica prime quand il existe', () => {
    expect(resolveResultDriverCode({ number: '50', Driver: { ...HIRAKAWA_DRIVER, code: 'OCO' } }, codeByNumber)).toBe('OCO')
  })

  it('sans trigramme : rattachement par numéro de voiture', () => {
    expect(resolveResultDriverCode({ number: '50', Driver: HIRAKAWA_DRIVER }, codeByNumber)).toBe('HIR')
  })

  it('sans trigramme ni numéro connu : inattribuable', () => {
    expect(resolveResultDriverCode({ number: '99', Driver: HIRAKAWA_DRIVER }, codeByNumber)).toBeNull()
    expect(resolveResultDriverCode({ Driver: HIRAKAWA_DRIVER }, codeByNumber)).toBeNull()
  })
})

describe('Jolpica — pilotes sans trigramme (#255)', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  function mockFetch(body: unknown) {
    vi.mocked(fetch).mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve(body),
    } as Response)
  }

  const MEXICO_QUALIFYING = {
    MRData: {
      RaceTable: {
        Races: [{
          QualifyingResults: [
            { number: '87', position: '14', Driver: { code: 'BEA', driverId: 'bearman', givenName: 'Oliver', familyName: 'Bearman' } },
            { number: '50', position: '18', Driver: HIRAKAWA_DRIVER, Constructor: { constructorId: 'haas', name: 'Haas F1 Team' } },
          ],
        }],
      },
    },
  }

  it('qualifs : la ligne sans trigramme est rattachée par numéro, position et écurie conservées', async () => {
    mockFetch(MEXICO_QUALIFYING)
    const results = await fetchQualifyingResults(2026, 19, new Map([[50, 'HIR'], [87, 'BEA']]))
    expect(results.get('HIR')).toMatchObject({ position: 18, constructorCode: 'HAAS' })
    expect(results.get('BEA')?.position).toBe(14)
  })

  // Avant #255, la ligne entrait dans la Map sous la clé `undefined`.
  it('qualifs : une ligne inattribuable est écartée, jamais indexée sous undefined', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch(MEXICO_QUALIFYING)
    const results = await fetchQualifyingResults(2026, 19, new Map([[87, 'BEA']]))
    expect([...results.keys()]).toEqual(['BEA'])
  })

  // Le numéro de la ligne sans trigramme pointe sur un pilote qui a déjà sa
  // propre ligne : le rattachement écraserait son classement → refusé.
  it('qualifs : jamais de rattachement sur un pilote déjà classé dans le même résultat', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch(MEXICO_QUALIFYING)
    const results = await fetchQualifyingResults(2026, 19, new Map([[50, 'BEA'], [87, 'BEA']]))
    expect(results.get('BEA')?.position).toBe(14)
    expect(results.size).toBe(1)
  })

  it('liste des pilotes : les entrées sans trigramme (rookies EL1, remplaçant) sont écartées', async () => {
    mockFetch({
      MRData: {
        DriverTable: {
          Drivers: [
            { code: 'OCO', driverId: 'ocon', givenName: 'Esteban', familyName: 'Ocon', permanentNumber: '31' },
            HIRAKAWA_DRIVER,
          ],
        },
      },
    })
    const drivers = await fetchDrivers(2026)
    expect(drivers.map((driver) => driver.code)).toEqual(['OCO'])
    expect(drivers[0].number).toBe(31)
  })
})

describe('fetchRaceLaps', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  function mockFetch(body: unknown) {
    vi.mocked(fetch).mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve(body),
    } as Response)
  }

  function raceWith(results: { position: string; laps?: string }[]) {
    return {
      MRData: {
        RaceTable: {
          Races: [
            {
              Results: results.map((r) => ({
                position:     r.position,
                positionText: r.position,
                Driver: { code: 'XXX', driverId: 'x', givenName: 'X', familyName: 'Y', permanentNumber: '1' },
                ...(r.laps ? { laps: r.laps } : {}),
              })),
            },
          ],
        },
      },
    }
  }

  it('retourne les tours du vainqueur (position "1")', async () => {
    // Vainqueur listé après un autre pilote → on cherche bien par position, pas l'index 0.
    mockFetch(raceWith([
      { position: '2', laps: '77' },
      { position: '1', laps: '78' },
    ]))
    expect(await fetchRaceLaps(2026, 8)).toBe(78)
  })

  it('retombe sur le premier résultat si aucune position "1"', async () => {
    mockFetch(raceWith([{ position: '2', laps: '56' }]))
    expect(await fetchRaceLaps(2026, 1)).toBe(56)
  })

  it('retourne null si pas de résultats (course non courue)', async () => {
    mockFetch(raceWith([]))
    expect(await fetchRaceLaps(2026, 99)).toBeNull()
  })

  it('retourne null si le champ laps est absent ou invalide', async () => {
    mockFetch(raceWith([{ position: '1' }]))
    expect(await fetchRaceLaps(2026, 2)).toBeNull()
  })
})
