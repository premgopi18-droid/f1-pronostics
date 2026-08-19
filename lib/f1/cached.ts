import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase'

// NB : pas de cache pour grands_prix — scoring_finalized_at mute hors du chemin
// de sync (pas de revalidateTag à la finalisation du scoring), donc le cacher
// périmerait les badges Définitif/Provisoire. Les pages le requêtent en direct.

export const getCachedDrivers = unstable_cache(
  async (season: number) => {
    const db = createServiceClient()
    const { data } = await db
      .from('drivers')
      .select('id, code, first_name, last_name, number, constructor_id')
      .eq('season', season)
      .order('code')
    return data ?? []
  },
  ['drivers'],
  { tags: ['drivers'], revalidate: 3600 },
)

export const getCachedConstructors = unstable_cache(
  async (season: number) => {
    const db = createServiceClient()
    const { data } = await db
      .from('constructors')
      .select('id, code, name')
      .eq('season', season)
      .order('name')
    return data ?? []
  },
  ['constructors'],
  { tags: ['constructors'], revalidate: 3600 },
)

// Écurie « actuelle » d'un pilote = celle de sa DERNIÈRE course disputée
// (session_results.constructor_code, #205) — code pilote → code écurie.
// Corrige la limite de drivers.constructor_id (« dernière écurie des standings
// Jolpica ») qui reste fausse après un remplacement temporaire : au retour du
// pilote dans son écurie d'origine, sa dernière course redevient la bonne
// référence toute seule. Les pilotes sans course disputée (constructor_code
// null partout) sont absents de la map — les appelants retombent sur
// constructor_id. Sérialisé en objet : unstable_cache passe par JSON.
export const getCachedLatestRaceConstructorCodes = unstable_cache(
  async (season: number): Promise<Record<string, string>> => {
    const db = createServiceClient()
    const { data } = await db
      .from('session_results')
      .select('constructor_code, drivers!driver_id(code), sessions!session_id!inner(type, starts_at)')
      .eq('season', season)
      .not('constructor_code', 'is', null)
      .in('sessions.type', ['race', 'sprint_race'])

    const latestByCode: Record<string, string> = {}
    const latestStartsAt = new Map<string, number>()
    for (const row of data ?? []) {
      if (!row.drivers || !row.constructor_code || !row.sessions) continue
      const startsAt = new Date(row.sessions.starts_at).getTime()
      const previous = latestStartsAt.get(row.drivers.code)
      if (previous === undefined || startsAt > previous) {
        latestStartsAt.set(row.drivers.code, startsAt)
        latestByCode[row.drivers.code] = row.constructor_code
      }
    }
    return latestByCode
  },
  ['latest-race-constructors'],
  { tags: ['drivers'], revalidate: 3600 },
)
