import { unstable_cache } from 'next/cache'

const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1'

async function jolpikaGet<T>(path: string): Promise<T> {
  const res = await fetch(`${JOLPICA_BASE}${path}.json`, { next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`Jolpica ${path} → HTTP ${res.status}`)
  return res.json() as Promise<T>
}

function toConstructorCode(constructorId: string): string {
  return constructorId.toUpperCase().replace(/-/g, '_')
}

// ── Types publics ──────────────────────────────────────────────────────────

export interface DriverStanding {
  code:            string
  name:            string  // familyName
  position:        number
  points:          number
  constructorCode: string  // pour la couleur équipe
}

export interface ConstructorStanding {
  code:     string
  name:     string
  position: number
  points:   number
}

// ── Fonctions cachées ──────────────────────────────────────────────────────

export const getCachedDriverStandings = unstable_cache(
  async (season: number): Promise<DriverStanding[]> => {
    const data = await jolpikaGet<{
      MRData: {
        StandingsTable: {
          StandingsLists: {
            DriverStandings: {
              position:     string
              points:       string
              Driver:       { code: string; givenName: string; familyName: string }
              Constructors: { constructorId: string }[]
            }[]
          }[]
        }
      }
    }>(`/${season}/driverStandings`)

    const standings = data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? []
    return standings.map((s) => ({
      code:            s.Driver.code,
      name:            s.Driver.familyName,
      position:        parseInt(s.position, 10),
      points:          parseFloat(s.points),
      constructorCode: toConstructorCode(s.Constructors[s.Constructors.length - 1]?.constructorId ?? ''),
    }))
  },
  ['driver-standings'],
  { tags: ['driver-standings'], revalidate: 300 },
)

export const getCachedConstructorStandings = unstable_cache(
  async (season: number): Promise<ConstructorStanding[]> => {
    const data = await jolpikaGet<{
      MRData: {
        StandingsTable: {
          StandingsLists: {
            ConstructorStandings: {
              position:    string
              points:      string
              Constructor: { constructorId: string; name: string }
            }[]
          }[]
        }
      }
    }>(`/${season}/constructorStandings`)

    const standings = data.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? []
    return standings.map((s) => ({
      code:     toConstructorCode(s.Constructor.constructorId),
      name:     s.Constructor.name,
      position: parseInt(s.position, 10),
      points:   parseFloat(s.points),
    }))
  },
  ['constructor-standings'],
  { tags: ['constructor-standings'], revalidate: 300 },
)

