import { createServiceClient } from '@/lib/supabase'
import { rawGpScore } from '@/lib/gp-score'

const RACE_SESSION_TYPE = 'race'
const PODIUM_SIZE = 3

export type PreviousGpCard = {
  name: string
  round: number
  country: string
  podium: { position: number; code: string }[]
  /** Score brut global de l'utilisateur sur ce GP, ou null s'il n'en a pas (aucune ligue / pas calculé). */
  rawScore: number | null
}

/**
 * Card « dernier GP » de la Home : podium officiel + score brut global de l'utilisateur.
 * Service client (lecture transverse), scores filtrés sur `userId`.
 */
export async function getPreviousGpCard(
  userId: string,
  season: number,
): Promise<PreviousGpCard | null> {
  const supabase = createServiceClient()

  const { data: gp } = await supabase
    .from('grands_prix')
    .select('id, name, round, country')
    .eq('season', season)
    .eq('is_cancelled', false)
    .not('scoring_finalized_at', 'is', null)
    .order('round', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!gp) return null

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, type')
    .eq('gp_id', gp.id)

  const sessionIds = (sessions ?? []).map((s) => s.id as string)
  const raceSession = (sessions ?? []).find((s) => s.type === RACE_SESSION_TYPE)

  const [podiumResult, scoreResult] = await Promise.all([
    raceSession
      ? supabase
          .from('session_results')
          .select('position, drivers!driver_id ( code )')
          .eq('session_id', raceSession.id)
          .gt('position', 0)
          .lte('position', PODIUM_SIZE)
          .order('position', { ascending: true })
      : Promise.resolve({ data: null }),
    sessionIds.length
      ? supabase.from('scores').select('session_id, base_score').eq('user_id', userId).in('session_id', sessionIds)
      : Promise.resolve({ data: null }),
  ])

  const podium = ((podiumResult.data ?? []) as unknown as Array<{
    position: number
    drivers: { code: string } | null
  }>).map((row) => ({ position: row.position, code: row.drivers?.code ?? '—' }))

  const scoreRows = (scoreResult.data ?? []) as Array<{ session_id: string; base_score: number }>
  const rawScore = scoreRows.length
    ? rawGpScore(scoreRows.map((r) => ({ sessionId: r.session_id, baseScore: r.base_score })))
    : null

  return {
    name: gp.name as string,
    round: gp.round as number,
    country: gp.country as string,
    podium,
    rawScore,
  }
}
