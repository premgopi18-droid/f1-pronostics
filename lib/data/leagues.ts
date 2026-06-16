import { createServiceClient } from '@/lib/supabase'
import { ITEM_USES_PER_SEASON } from '@/lib/scoring/constants'

// ── Lecture (cron) ────────────────────────────────────────────────────────

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

// ── Écriture (actions utilisateur) ───────────────────────────────────────

// Distribue l'inventaire d'items de début de saison à un joueur qui rejoint une ligue.
// Idempotent (upsert) — peut être rappelé sans risque si la transaction reprend.
async function initUserItems(
  userId:   string,
  leagueId: string,
  season:   number,
): Promise<void> {
  const supabase = createServiceClient()
  const rows = Object.entries(ITEM_USES_PER_SEASON).map(([itemType, uses]) => ({
    user_id:        userId,
    league_id:      leagueId,
    season,
    item_type:      itemType,
    uses_remaining: uses,
  }))
  const { error } = await supabase
    .from('user_items')
    .upsert(rows, { onConflict: 'user_id,league_id,season,item_type' })
  if (error) throw error
}

export async function createLeague(
  userId:     string,
  name:       string,
  maxMembers: number,
  season:     number,
): Promise<{ leagueId: string; inviteCode: string }> {
  const supabase = createServiceClient()

  // Code court lisible — retire les tirets du UUID et prend 8 chars
  const inviteCode = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()

  const { data: league, error: leagueError } = await supabase
    .from('leagues')
    .insert({ name, invite_code: inviteCode, invite_open: true, max_members: maxMembers })
    .select('id')
    .single()

  if (leagueError) throw leagueError

  const leagueId = league.id as string

  const { error: memberError } = await supabase
    .from('league_members')
    .insert({ league_id: leagueId, user_id: userId, season, is_admin: true })

  if (memberError) throw memberError

  await initUserItems(userId, leagueId, season)

  return { leagueId, inviteCode }
}

export async function joinLeagueByCode(
  userId:     string,
  inviteCode: string,
  season:     number,
): Promise<{ leagueId: string }> {
  const supabase = createServiceClient()

  const { data: league, error: leagueError } = await supabase
    .from('leagues')
    .select('id, invite_open, max_members')
    .eq('invite_code', inviteCode)
    .single()

  if (leagueError || !league) throw new Error('Ligue introuvable — vérifie le code')
  if (!league.invite_open)    throw new Error('Les inscriptions sont fermées pour cette ligue')

  const { data: existing } = await supabase
    .from('league_members')
    .select('id')
    .eq('league_id', league.id)
    .eq('user_id', userId)
    .eq('season', season)
    .maybeSingle()

  if (existing) throw new Error('Tu es déjà membre de cette ligue')

  const { error: memberError } = await supabase
    .from('league_members')
    .insert({ league_id: league.id, user_id: userId, season, is_admin: false })

  // Le trigger DB vérifie max_members — on laisse son erreur remonter telle quelle
  if (memberError) throw new Error(memberError.message)

  await initUserItems(userId, league.id as string, season)

  return { leagueId: league.id as string }
}
