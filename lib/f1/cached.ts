import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase'

export const getCachedGrandsPrix = unstable_cache(
  async (season: number) => {
    const db = createServiceClient()
    const { data } = await db
      .from('grands_prix')
      .select('id, name, country, round, scoring_finalized_at, weekend_starts_at, is_cancelled, is_sprint_weekend')
      .eq('season', season)
      .order('round', { ascending: true })
    return data ?? []
  },
  ['grands_prix'],
  { tags: ['grands_prix'], revalidate: 3600 },
)

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
