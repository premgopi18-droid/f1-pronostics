import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchPracticeResults, fetchSprintQualifyingResults, fetchStartingGrid } from './openf1'

// Les dates 2025 sont dans le passé (now = 2026) → sessions « terminées » par
// défaut, sauf test dédié où l'on place date_end dans le futur.
type SessionFixture = {
  session_key:        number
  session_name:       string
  year:               number
  circuit_short_name: string
  date_start:         string
  date_end:           string
}

describe('openf1 — sélection de session par date', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // Route la réponse selon le path OpenF1 appelé (/sessions, /drivers, /laps, /position, /starting_grid).
  // La grille n'est servie QUE pour `gridSessionKey` : l'API réelle indexe
  // /starting_grid par le session_key de la session QUALIFICATIVE — un mock
  // indifférent au paramètre laisserait passer une requête sur la mauvaise
  // session (bug de la PR #202).
  function mockOpenF1(payloads: {
    sessions?:  SessionFixture[]
    drivers?:   { driver_number: number; name_acronym: string; session_key: number }[]
    laps?:      { driver_number: number; lap_duration: number | null; date_start: string | null }[]
    positions?: { driver_number: number; position: number; date: string }[]
    grid?:      { driver_number: number; position: number | null }[]
    gridSessionKey?: number
  }) {
    vi.mocked(fetch).mockImplementation((input: string | URL | Request) => {
      const url = input.toString()
      const body =
        url.includes('/starting_grid')
          ? (payloads.gridSessionKey !== undefined && url.includes(`session_key=${payloads.gridSessionKey}`)
              ? payloads.grid ?? []
              : [])
          :
        url.includes('/sessions')  ? payloads.sessions  ?? [] :
        url.includes('/drivers')   ? payloads.drivers   ?? [] :
        url.includes('/laps')      ? payloads.laps      ?? [] :
        url.includes('/position')  ? payloads.positions ?? [] :
        []
      return Promise.resolve({
        status: 200,
        ok:     true,
        json:   () => Promise.resolve(body),
      } as Response)
    })
  }

  describe('fetchPracticeResults', () => {
    it('retient la session du bon week-end (par date) et classe par meilleur tour', async () => {
      mockOpenF1({
        sessions: [
          // Décoy : autre GP, une semaine avant → hors fenêtre, ne doit pas être retenu.
          { session_key: 50, session_name: 'Practice 1', year: 2025,
            circuit_short_name: 'Monte Carlo', date_start: '2025-05-23T11:30:00+00:00', date_end: '2025-05-23T12:30:00+00:00' },
          // Cible : Barcelone (OpenF1 « Catalunya » ≠ locality Jolpica « Montmeló »).
          { session_key: 100, session_name: 'Practice 1', year: 2025,
            circuit_short_name: 'Catalunya', date_start: '2025-05-30T11:30:00+00:00', date_end: '2025-05-30T12:30:00+00:00' },
        ],
        drivers: [
          { driver_number: 1,  name_acronym: 'VER', session_key: 100 },
          { driver_number: 4,  name_acronym: 'NOR', session_key: 100 },
          { driver_number: 16, name_acronym: 'LEC', session_key: 100 },
        ],
        laps: [
          { driver_number: 1,  lap_duration: null,  date_start: null },                       // out-lap ignoré
          { driver_number: 1,  lap_duration: 78.5,  date_start: '2025-05-30T11:40:00+00:00' },
          { driver_number: 4,  lap_duration: 78.2,  date_start: '2025-05-30T11:42:00+00:00' }, // meilleur
          { driver_number: 16, lap_duration: 78.9,  date_start: '2025-05-30T11:44:00+00:00' },
        ],
      })

      const results = await fetchPracticeResults(2025, 'Practice 1', '2025-05-30T11:30:00Z')

      expect(results).toEqual([
        { position: 1, driverCode: 'NOR', bestLapTime: '1:18.200' },
        { position: 2, driverCode: 'VER', bestLapTime: '1:18.500' },
        { position: 3, driverCode: 'LEC', bestLapTime: '1:18.900' },
      ])
    })

    it('renvoie [] si aucune session ne tombe dans la fenêtre de 2 jours', async () => {
      mockOpenF1({
        sessions: [
          { session_key: 50, session_name: 'Practice 1', year: 2025,
            circuit_short_name: 'Monte Carlo', date_start: '2025-05-23T11:30:00+00:00', date_end: '2025-05-23T12:30:00+00:00' },
        ],
      })

      const results = await fetchPracticeResults(2025, 'Practice 1', '2025-08-01T11:30:00Z')
      expect(results).toEqual([])
    })

    it('renvoie [] tant que la session n’est pas terminée (date_end futur)', async () => {
      mockOpenF1({
        sessions: [
          { session_key: 100, session_name: 'Practice 1', year: 2099,
            circuit_short_name: 'Catalunya', date_start: '2099-05-30T11:30:00+00:00', date_end: '2099-05-30T12:30:00+00:00' },
        ],
        laps: [{ driver_number: 1, lap_duration: 78.5, date_start: '2099-05-30T11:40:00+00:00' }],
      })

      const results = await fetchPracticeResults(2099, 'Practice 1', '2099-05-30T11:30:00Z')
      expect(results).toEqual([])
    })

    it('départage les ex aequo par le premier à avoir signé le temps', async () => {
      mockOpenF1({
        sessions: [
          { session_key: 100, session_name: 'Practice 2', year: 2025,
            circuit_short_name: 'Catalunya', date_start: '2025-05-30T15:00:00+00:00', date_end: '2025-05-30T16:00:00+00:00' },
        ],
        drivers: [
          { driver_number: 1, name_acronym: 'VER', session_key: 100 },
          { driver_number: 4, name_acronym: 'NOR', session_key: 100 },
        ],
        laps: [
          { driver_number: 1, lap_duration: 80.0, date_start: '2025-05-30T15:30:00+00:00' }, // même temps, plus tard
          { driver_number: 4, lap_duration: 80.0, date_start: '2025-05-30T15:20:00+00:00' }, // signé en premier → P1
        ],
      })

      const results = await fetchPracticeResults(2025, 'Practice 2', '2025-05-30T15:00:00Z')
      expect(results).toEqual([
        { position: 1, driverCode: 'NOR', bestLapTime: '1:20.000' },
        { position: 2, driverCode: 'VER', bestLapTime: '1:20.000' },
      ])
    })

    it('formate le meilleur tour en m:ss.mmm (padding secondes et millisecondes)', async () => {
      mockOpenF1({
        sessions: [
          { session_key: 100, session_name: 'Practice 3', year: 2025,
            circuit_short_name: 'Catalunya', date_start: '2025-05-31T10:30:00+00:00', date_end: '2025-05-31T11:30:00+00:00' },
        ],
        drivers: [
          { driver_number: 1, name_acronym: 'VER', session_key: 100 },
          { driver_number: 4, name_acronym: 'NOR', session_key: 100 },
        ],
        laps: [
          // 65.04s → 1:05.040 : secondes < 10 et millisecondes < 100 → padding requis.
          { driver_number: 4, lap_duration: 65.04,  date_start: '2025-05-31T10:40:00+00:00' },
          // 123.4s → 2:03.400 : passage à 2 minutes.
          { driver_number: 1, lap_duration: 123.4,  date_start: '2025-05-31T10:42:00+00:00' },
        ],
      })

      const results = await fetchPracticeResults(2025, 'Practice 3', '2025-05-31T10:30:00Z')
      expect(results).toEqual([
        { position: 1, driverCode: 'NOR', bestLapTime: '1:05.040' },
        { position: 2, driverCode: 'VER', bestLapTime: '2:03.400' },
      ])
    })
  })

  describe('fetchSprintQualifyingResults', () => {
    it('mappe code → position depuis la session rapprochée par date', async () => {
      mockOpenF1({
        sessions: [
          { session_key: 200, session_name: 'Sprint Qualifying', year: 2025,
            circuit_short_name: 'Shanghai', date_start: '2025-03-21T07:30:00+00:00', date_end: '2025-03-21T08:14:00+00:00' },
        ],
        drivers: [
          { driver_number: 1,  name_acronym: 'VER', session_key: 200 },
          { driver_number: 44, name_acronym: 'HAM', session_key: 200 },
        ],
        positions: [
          { driver_number: 1,  position: 2, date: '2025-03-21T08:00:00+00:00' },
          { driver_number: 44, position: 1, date: '2025-03-21T08:00:00+00:00' },
        ],
      })

      const results = await fetchSprintQualifyingResults(2025, '2025-03-21T07:30:00Z')

      expect(results.get('VER')).toEqual({ position: 2, fastestLap: false })
      expect(results.get('HAM')).toEqual({ position: 1, fastestLap: false })
    })

    it('renvoie une Map vide si aucune session proche', async () => {
      mockOpenF1({ sessions: [] })
      const results = await fetchSprintQualifyingResults(2025, '2025-03-21T07:30:00Z')
      expect(results.size).toBe(0)
    })
  })

  describe('fetchStartingGrid', () => {
    // /starting_grid est indexé par le session_key de la QUALIF (vérifié sur
    // l'API réelle — review PR #202) : les fixtures ciblent donc une session
    // Qualifying, et le mock ne sert la grille que pour son session_key.
    it('interroge la grille via la session QUALIFICATIVE, disponible avant la course', async () => {
      // Qualif terminée hier (2025), course pas encore courue : la grille doit
      // être disponible — aucune fonction résultats ne le permettrait.
      mockOpenF1({
        sessions: [
          { session_key: 300, session_name: 'Qualifying', year: 2025,
            circuit_short_name: 'Catalunya', date_start: '2025-05-30T14:00:00+00:00', date_end: '2025-05-30T15:00:00+00:00' },
        ],
        drivers: [
          { driver_number: 1,  name_acronym: 'VER', session_key: 300 },
          { driver_number: 4,  name_acronym: 'NOR', session_key: 300 },
          { driver_number: 44, name_acronym: 'HAM', session_key: 300 },
        ],
        grid: [
          { driver_number: 4,  position: 1 },
          { driver_number: 44, position: 2 },
          { driver_number: 1,  position: 3 },
        ],
        gridSessionKey: 300,
      })

      const grid = await fetchStartingGrid(2025, 'Qualifying', '2025-05-30T14:00:00Z')

      expect(grid.get('NOR')).toBe(1)
      expect(grid.get('HAM')).toBe(2)
      expect(grid.get('VER')).toBe(3)
    })

    it('ignore les pilotes sans position de grille (pit lane) et les numéros inconnus', async () => {
      mockOpenF1({
        sessions: [
          { session_key: 310, session_name: 'Sprint Qualifying', year: 2025,
            circuit_short_name: 'Shanghai', date_start: '2025-03-21T07:30:00+00:00', date_end: '2025-03-21T08:14:00+00:00' },
        ],
        drivers: [
          { driver_number: 1, name_acronym: 'VER', session_key: 310 },
          { driver_number: 4, name_acronym: 'NOR', session_key: 310 },
        ],
        grid: [
          { driver_number: 1,  position: 1 },
          { driver_number: 4,  position: null }, // départ pit lane → exclu
          { driver_number: 99, position: 2 },    // numéro sans correspondance /drivers → exclu
        ],
        gridSessionKey: 310,
      })

      const grid = await fetchStartingGrid(2025, 'Sprint Qualifying', '2025-03-21T07:30:00Z')

      expect(grid.size).toBe(1)
      expect(grid.get('VER')).toBe(1)
    })

    it('renvoie une Map vide si la grille n’est pas encore publiée', async () => {
      mockOpenF1({
        sessions: [
          { session_key: 300, session_name: 'Qualifying', year: 2025,
            circuit_short_name: 'Catalunya', date_start: '2025-05-30T14:00:00+00:00', date_end: '2025-05-30T15:00:00+00:00' },
        ],
        drivers: [{ driver_number: 1, name_acronym: 'VER', session_key: 300 }],
        grid: [],
        gridSessionKey: 300,
      })

      const grid = await fetchStartingGrid(2025, 'Qualifying', '2025-05-30T14:00:00Z')
      expect(grid.size).toBe(0)
    })

    it('renvoie une Map vide si aucune session ne tombe dans la fenêtre de 2 jours', async () => {
      mockOpenF1({
        sessions: [
          { session_key: 300, session_name: 'Qualifying', year: 2025,
            circuit_short_name: 'Catalunya', date_start: '2025-05-30T14:00:00+00:00', date_end: '2025-05-30T15:00:00+00:00' },
        ],
      })

      const grid = await fetchStartingGrid(2025, 'Qualifying', '2025-08-01T13:00:00Z')
      expect(grid.size).toBe(0)
    })

    it('grille servie uniquement pour le session_key de la qualif — une requête sur une autre session revient vide', async () => {
      // Garde-fou anti-régression du bug #202 : deux sessions dans la fenêtre
      // (la qualif et la course), la grille n'existe que pour la qualif. Si le
      // code re-cible un jour la session course, ce test échoue.
      mockOpenF1({
        sessions: [
          { session_key: 301, session_name: 'Race', year: 2025,
            circuit_short_name: 'Catalunya', date_start: '2025-05-31T13:00:00+00:00', date_end: '2025-05-31T15:00:00+00:00' },
          { session_key: 300, session_name: 'Qualifying', year: 2025,
            circuit_short_name: 'Catalunya', date_start: '2025-05-30T14:00:00+00:00', date_end: '2025-05-30T15:00:00+00:00' },
        ],
        drivers: [{ driver_number: 1, name_acronym: 'VER', session_key: 300 }],
        grid: [{ driver_number: 1, position: 1 }],
        gridSessionKey: 300,
      })

      const grid = await fetchStartingGrid(2025, 'Qualifying', '2025-05-30T14:00:00Z')
      expect(grid.get('VER')).toBe(1)
    })
  })
})
