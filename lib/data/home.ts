import { createServiceClient } from '@/lib/supabase'
import { rawGpScore } from '@/lib/gp-score'
import {
  homeGpPhase,
  sessionLockState,
  type HomeGpPhase,
  type WeekendSession,
} from '@/lib/home-phase'
import { SCOREABLE_SESSION_TYPES, type SessionType } from '@/lib/scoring/types'

const RACE_SESSION_TYPE = 'race'
const PODIUM_SIZE = 3

export type CurrentGpView = { phase: HomeGpPhase; sessions: WeekendSession[] }

/**
 * Phase du GP courant (countdown / week-end / live / calcul) + ses sessions pour la
 * card week-end. `Date.now()` est lu ici (fonction de données, hors render React).
 */
export async function getCurrentGpView(
  gpId: string,
  weekendStartsAt: string | null,
): Promise<CurrentGpView> {
  const supabase = createServiceClient()
  const nowMs = Date.now()

  const { data: rows, error } = await supabase
    .from('sessions')
    .select('type, starts_at, results_confirmed_at')
    .eq('gp_id', gpId)
    // Essais libres exclus : la card week-end et le calcul de phase ne portent
    // que sur les sessions scorées (le « début du GP » est hors essais).
    .in('type', SCOREABLE_SESSION_TYPES)
    .order('starts_at', { ascending: true })

  if (error) console.error('[data/home] sessions (view)', error)

  const sessions = (rows ?? []) as Array<{
    type: string
    starts_at: string
    results_confirmed_at: string | null
  }>

  const phase = homeGpPhase(
    nowMs,
    weekendStartsAt,
    sessions.map((s) => ({ startsAt: s.starts_at, resultsConfirmedAt: s.results_confirmed_at })),
  )

  return {
    phase,
    sessions: sessions.map((s) => ({
      type: s.type as SessionType,
      lockState: sessionLockState(nowMs, s.starts_at),
    })),
  }
}

export type PreviousGpCard = {
  name: string
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

  const { data: gp, error: gpError } = await supabase
    .from('grands_prix')
    .select('id, name')
    .eq('season', season)
    .eq('is_cancelled', false)
    .not('scoring_finalized_at', 'is', null)
    .order('round', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Fail-soft : la card est non critique, on ne casse pas la Home — mais on trace.
  if (gpError) console.error('[data/home] grands_prix', gpError)
  if (!gp) return null

  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, type')
    .eq('gp_id', gp.id)

  if (sessionsError) console.error('[data/home] sessions', sessionsError)

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
      : Promise.resolve({ data: null, error: null }),
    sessionIds.length
      ? supabase.from('scores').select('session_id, base_score').eq('user_id', userId).in('session_id', sessionIds)
      : Promise.resolve({ data: null, error: null }),
  ])

  if (podiumResult.error) console.error('[data/home] session_results', podiumResult.error)
  if (scoreResult.error) console.error('[data/home] scores', scoreResult.error)

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
    podium,
    rawScore,
  }
}
