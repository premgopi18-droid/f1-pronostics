import { createServiceClient } from '@/lib/supabase'
import { ITEM_USES_PER_SEASON } from '@/lib/scoring/constants'
import { leagueJoinStatus, type LeagueJoinStatus } from '@/lib/leagues/join-status'

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

  // Inventaire d'items du créateur — passé à la fonction transactionnelle pour
  // garder ITEM_USES_PER_SEASON comme source unique (pas de duplication en SQL).
  const items = Object.entries(ITEM_USES_PER_SEASON).map(([itemType, uses]) => ({
    item_type:      itemType,
    uses_remaining: uses,
  }))

  // RPC transactionnelle (cf. supabase/migrations/..._create_league_function.sql) :
  // ligue + admin + items dans une seule transaction, code d'invitation généré
  // côté Postgres avec retry sur collision UNIQUE. Évite toute ligue orpheline.
  const { data, error } = await supabase
    .rpc('create_league', {
      p_name:        name,
      p_max_members: maxMembers,
      p_user_id:     userId,
      p_season:      season,
      p_items:       items,
    })
    .single()

  if (error) throw error
  const row = data as { league_id: string; invite_code: string }
  return { leagueId: row.league_id, inviteCode: row.invite_code }
}

export type LeaguePreview =
  | { status: 'not_found' }
  | {
      status: LeagueJoinStatus
      name: string
      memberCount: number
      maxMembers: number
      adminPseudo: string | null
      season: number
    }

/**
 * Aperçu d'une ligue depuis son code d'invitation, SANS rejoindre — pour la landing
 * d'invitation. Service client (l'invité n'est pas encore membre → hors RLS).
 *
 * Les erreurs Supabase remontent (cf. convention du data layer) : on distingue
 * « code introuvable » (data null → not_found) d'un échec de requête (throw).
 */
export async function getLeagueByCode(
  inviteCode: string,
  season: number,
): Promise<LeaguePreview> {
  const supabase = createServiceClient()

  const { data: league, error: leagueError } = await supabase
    .from('leagues')
    .select('id, name, invite_open, max_members')
    .eq('invite_code', inviteCode)
    .maybeSingle()

  if (leagueError) throw leagueError
  if (!league) return { status: 'not_found' }

  // count et admin sont indépendants une fois la ligue connue → en parallèle.
  const [memberCountResult, adminResult] = await Promise.all([
    supabase
      .from('league_members')
      .select('id', { count: 'exact', head: true })
      .eq('league_id', league.id)
      .eq('season', season),
    supabase
      .from('league_members')
      .select('profiles!user_id ( pseudo )')
      .eq('league_id', league.id)
      .eq('season', season)
      .eq('is_admin', true)
      .maybeSingle(),
  ])

  if (memberCountResult.error) throw memberCountResult.error
  if (adminResult.error) throw adminResult.error

  const memberCount = memberCountResult.count ?? 0
  const adminPseudo =
    (adminResult.data?.profiles as unknown as { pseudo: string } | null)?.pseudo ?? null

  return {
    status: leagueJoinStatus(league.invite_open, memberCount, league.max_members),
    name: league.name as string,
    memberCount,
    maxMembers: league.max_members as number,
    adminPseudo,
    season,
  }
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
