import { createServiceClient } from '@/lib/supabase'
import { POSITIONS_TO_SCORE } from '@/lib/scoring/constants'
import { rawGpScore } from '@/lib/gp-score'
import { sessionLockState } from '@/lib/home-phase'
import { SCOREABLE_SESSION_TYPES, type SessionType } from '@/lib/scoring/types'

export interface PredictionRow {
  userId:  string
  entries: string[]
}

// ── Prédictions de session (scoring phase 1) ──────────────────────────────

export async function getPredictionsForSession(
  sessionId: string,
): Promise<PredictionRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('predictions')
    .select('user_id, entries')
    .eq('session_id', sessionId)
    .eq('is_valid', true)

  if (error) throw error
  return (data ?? []).map((row) => ({ userId: row.user_id, entries: row.entries as string[] }))
}

// userId → code pilote prédit pour le meilleur tour
export async function getFastestLapForSession(
  sessionId: string,
): Promise<Map<string, string>> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('fastest_lap_predictions')
    .select('user_id, drivers!driver_id(code)')
    .eq('session_id', sessionId)

  if (error) throw error

  const result = new Map<string, string>()
  for (const row of data ?? []) {
    // Embed via FK (`drivers!driver_id`) = relation many-to-one → PostgREST renvoie
    // un objet (pas un tableau). À confirmer en intégration (test plan).
    const driver = row.drivers
    if (driver) result.set(row.user_id, driver.code)
  }
  return result
}

// ── Prédictions saison WDC/WCC (scoring fin de saison) ───────────────────

export async function getSeasonPredictions(
  season: number,
  type: 'wdc' | 'wcc',
): Promise<PredictionRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('season_predictions')
    .select('user_id, entries')
    .eq('season', season)
    .eq('type', type)

  if (error) throw error
  return (data ?? []).map((row) => ({ userId: row.user_id, entries: row.entries as string[] }))
}

// ── Écriture (actions utilisateur) ───────────────────────────────────────

export async function submitPrediction(
  userId:      string,
  sessionId:   string,
  season:      number,
  sessionType: SessionType,
  entries:     string[],
): Promise<void> {
  const supabase = createServiceClient()
  const expected = POSITIONS_TO_SCORE[sessionType]
  const { error } = await supabase
    .from('predictions')
    .upsert(
      {
        user_id:      userId,
        session_id:   sessionId,
        season,
        entries,
        is_valid:     entries.length === expected,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,session_id' },
    )
  if (error) throw error
}

export async function submitFastestLap(
  userId:    string,
  sessionId: string,
  season:    number,
  driverId:  string,
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('fastest_lap_predictions')
    .upsert(
      {
        user_id:      userId,
        session_id:   sessionId,
        season,
        driver_id:    driverId,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,session_id' },
    )
  if (error) throw error
}

// ── Onglet « Mes Pronos » ─────────────────────────────────────────────────────

/**
 * Score brut global de l'utilisateur pour chaque GP finalisé de la saison.
 * null = aucun score (pas en ligue ou scores pas encore calculés).
 */
export async function getGpHistoryScores(
  userId: string,
  season: number,
): Promise<Map<string, number | null>> {
  const supabase = createServiceClient()

  const { data: gps, error: gpError } = await supabase
    .from('grands_prix')
    .select('id')
    .eq('season', season)
    .eq('is_cancelled', false)
    .not('scoring_finalized_at', 'is', null)

  if (gpError) { console.error('[data/predictions] grands_prix', gpError); return new Map() }
  if (!gps || gps.length === 0) return new Map()

  const gpIds = gps.map((gp) => gp.id)

  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, gp_id')
    .in('gp_id', gpIds)

  if (sessionsError) { console.error('[data/predictions] sessions', sessionsError); return new Map() }

  const allSessions = sessions ?? []
  const sessionIds = allSessions.map((s) => s.id)
  const sessionToGp = new Map(allSessions.map((s) => [s.id, s.gp_id]))

  if (sessionIds.length === 0) return new Map(gpIds.map((id) => [id, null]))

  // Pas de filtre league_id : base_score est global (même valeur quelle que soit la ligue).
  // rawGpScore déduplique par sessionId si l'user est dans plusieurs ligues.
  const { data: scoreRows, error: scoresError } = await supabase
    .from('scores')
    .select('session_id, base_score')
    .eq('user_id', userId)
    .in('session_id', sessionIds)

  if (scoresError) console.error('[data/predictions] scores', scoresError)

  const byGp = new Map<string, { sessionId: string; baseScore: number }[]>()
  for (const row of scoreRows ?? []) {
    const gpId = sessionToGp.get(row.session_id)
    if (!gpId) continue
    const list = byGp.get(gpId) ?? []
    list.push({ sessionId: row.session_id, baseScore: row.base_score })
    byGp.set(gpId, list)
  }

  const result = new Map<string, number | null>()
  for (const gpId of gpIds) {
    const sessionScores = byGp.get(gpId)
    result.set(gpId, sessionScores ? rawGpScore(sessionScores) : null)
  }
  return result
}

export type GpSessionView = {
  type: SessionType
  lockState: 'open' | 'locked'
  hasSubmitted: boolean
  startsAt: string
}

/**
 * Sessions du GP courant avec état de verrouillage et soumission de l'utilisateur.
 */
export async function getCurrentGpSessionStatuses(
  userId: string,
  gpId: string,
): Promise<GpSessionView[]> {
  const supabase = createServiceClient()
  const nowMs = Date.now()

  const { data: sessionRows, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, type, starts_at')
    .eq('gp_id', gpId)
    // Exclut les essais libres (informatifs) : seules les sessions scorées sont
    // pronosticables. Sinon `SESSION_LABEL[type]` est undefined → crash render.
    .in('type', SCOREABLE_SESSION_TYPES)
    .order('starts_at', { ascending: true })

  if (sessionsError) { console.error('[data/predictions] sessions (current gp)', sessionsError); return [] }

  const sessionIds = (sessionRows ?? []).map((s) => s.id)

  const { data: predRows, error: predError } = sessionIds.length
    ? await supabase
        .from('predictions')
        .select('session_id')
        .eq('user_id', userId)
        .eq('is_valid', true)
        .in('session_id', sessionIds)
    : { data: [] as { session_id: string }[], error: null }

  if (predError) console.error('[data/predictions] predictions', predError)

  const submittedIds = new Set((predRows ?? []).map((r) => r.session_id))

  return (sessionRows ?? []).map((s) => ({
    type: s.type as SessionType,
    lockState: sessionLockState(nowMs, s.starts_at),
    hasSubmitted: submittedIds.has(s.id),
    startsAt: s.starts_at,
  }))
}

/**
 * Sessions pronosticables d'un GP + qui (parmi `userIds`) a soumis un prono
 * valide pour chacune — pour le bloc « Qui est prêt ? » de la page ligue
 * (product-specs §7). Client service role : la RLS interdit de lire les pronos
 * des co-membres avant le début de session, on n'expose donc QUE des booléens
 * de soumission, jamais les `entries`. Appelé uniquement depuis la page ligue,
 * dont l'accès est déjà restreint aux membres.
 */
export async function getGpSubmissionStatus(
  userIds: string[],
  gpId: string,
): Promise<{
  sessions: { id: string; type: SessionType; startsAt: string }[]
  submittedBySession: Map<string, Set<string>>
}> {
  const supabase = createServiceClient()

  const { data: sessionRows, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, type, starts_at')
    .eq('gp_id', gpId)
    .in('type', SCOREABLE_SESSION_TYPES)
    .order('starts_at', { ascending: true })

  if (sessionsError) {
    console.error('[data/predictions] sessions (readiness)', sessionsError)
    return { sessions: [], submittedBySession: new Map() }
  }

  const sessions = (sessionRows ?? []).map((s) => ({
    id: s.id,
    type: s.type as SessionType,
    startsAt: s.starts_at,
  }))
  const sessionIds = sessions.map((s) => s.id)

  const { data: predictionRows, error: predictionsError } =
    sessionIds.length && userIds.length
      ? await supabase
          .from('predictions')
          .select('user_id, session_id')
          .in('user_id', userIds)
          .in('session_id', sessionIds)
          .eq('is_valid', true)
      : { data: [] as { user_id: string; session_id: string }[], error: null }

  if (predictionsError) console.error('[data/predictions] predictions (readiness)', predictionsError)

  const submittedBySession = new Map<string, Set<string>>()
  for (const row of predictionRows ?? []) {
    const users = submittedBySession.get(row.session_id) ?? new Set<string>()
    users.add(row.user_id)
    submittedBySession.set(row.session_id, users)
  }

  return { sessions, submittedBySession }
}
