import { createServiceClient } from '@/lib/supabase'

export async function getActiveLeagues(season: number): Promise<string[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('league_members')
    .select('league_id')
    .eq('season', season)

  if (error) throw error
  return [...new Set((data ?? []).map((row) => row.league_id as string))]
}

export async function getLeagueMembers(
  leagueId: string,
  season:   number,
): Promise<string[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('league_members')
    .select('user_id')
    .eq('league_id', leagueId)
    .eq('season', season)

  if (error) throw error
  return (data ?? []).map((row) => row.user_id as string)
}
