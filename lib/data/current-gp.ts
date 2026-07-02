import { createServiceClient } from '@/lib/supabase'

/**
 * GP courant = premier GP non annulé dont le scoring n'est pas finalisé
 * (`scoring_finalized_at IS NULL`, plus petit `round`). Source unique réutilisée par
 * la Home et par le slice items (règle « items jouables uniquement sur le GP courant »,
 * cf. product-specs §3.5). `null` en fin de saison (tout finalisé).
 */
export type CurrentGp = {
  id:              string
  name:            string
  country:         string
  round:           number
  weekendStartsAt: string | null
}

export async function getCurrentGp(season: number): Promise<CurrentGp | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('grands_prix')
    .select('id, name, country, round, weekend_starts_at')
    .eq('season', season)
    .eq('is_cancelled', false)
    .is('scoring_finalized_at', null)
    .order('round', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id:              data.id as string,
    name:            data.name as string,
    country:         data.country as string,
    round:           data.round as number,
    weekendStartsAt: (data.weekend_starts_at as string | null) ?? null,
  }
}
