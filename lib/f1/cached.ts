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
      .select('id, code, first_name, last_name, number')
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
