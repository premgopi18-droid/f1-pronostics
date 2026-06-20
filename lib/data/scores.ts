import { createServiceClient } from '@/lib/supabase'
import type { ScoreKey, SessionScore, SessionType } from '@/lib/scoring/types'

export interface SeasonScoreRow {
  userId:   string
  wdcScore: number
  wdcBonus: number
  wccScore: number
  wccBonus: number
}

// ── Lecture ───────────────────────────────────────────────────────────────

// Map<ScoreKey, SessionScore> pour un GP entier — entrée de applyItemEffects
export async function getCurrentScoresForGP(
  gpId: string,
  leagueId: string,
): Promise<Map<ScoreKey, SessionScore>> {
  const supabase = createServiceClient()

  // 1. Sessions de ce GP
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, type')
    .eq('gp_id', gpId)

  if (sessionsError) throw sessionsError

  const sessionIds = (sessions ?? []).map((s) => s.id as string)
  const typeById   = new Map((sessions ?? []).map((s) => [s.id as string, s.type as SessionType]))

  if (sessionIds.length === 0) return new Map()

  // 2. Scores pour ces sessions
  const { data: rows, error } = await supabase
    .from('scores')
    .select('user_id, session_id, base_score, final_score, exact_positions, breakdown')
    .eq('league_id', leagueId)
    .in('session_id', sessionIds)

  if (error) throw error

  const result = new Map<ScoreKey, SessionScore>()
  for (const row of rows ?? []) {
    const sessionType = typeById.get(row.session_id as string)
    if (!sessionType) continue
    const key: ScoreKey = `${row.user_id}:${sessionType}`
    result.set(key, {
      baseScore:      row.base_score as number,
      finalScore:     row.final_score as number,
      exactPositions: row.exact_positions as number,
      breakdown:      row.breakdown as SessionScore['breakdown'],
    })
  }
  return result
}

// Sessions dont les résultats sont confirmés mais pas encore scorées pour cette ligue.
// Filtrer par ligue permet : (1) de créer des ligues en cours de saison avec catch-up
// automatique, (2) de rejouer indépendamment par ligue si le cron plante à mi-chemin.
export async function getPendingSessionScores(
  leagueId: string,
): Promise<{ id: string; gpId: string; season: number; type: SessionType }[]> {
  const supabase = createServiceClient()

  const [{ data: sessions, error: sessionsError }, { data: scored, error: scoredError }] =
    await Promise.all([
      supabase
        .from('sessions')
        .select('id, gp_id, season, type')
        .not('results_confirmed_at', 'is', null),
      supabase
        .from('scores')
        .select('session_id')
        .eq('league_id', leagueId),
    ])

  if (sessionsError) throw sessionsError
  if (scoredError)   throw scoredError

  const scoredIds = new Set((scored ?? []).map((r) => r.session_id as string))

  return (sessions ?? [])
    .filter((row) => !scoredIds.has(row.id as string))
    .map((row) => ({
      id:     row.id as string,
      gpId:   row.gp_id as string,
      season: row.season as number,
      type:   row.type as SessionType,
    }))
}

// GPs dont la course est scorée mais scoring_finalized_at est null
export async function getPendingItemResolutions(): Promise<
  { id: string; season: number; name: string }[]
> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('grands_prix')
    .select('id, name, season, sessions!inner(id, type, results_confirmed_at, scores(id))')
    .is('scoring_finalized_at', null)

  if (error) throw error

  return (data ?? []).filter((gp) => {
    const sessions = gp.sessions as {
      id: string; type: string; results_confirmed_at: string | null; scores: { id: string }[]
    }[]
    // GP éligible si la race a des résultats confirmés ET au moins 1 score existant
    const race = sessions.find((s) => s.type === 'race')
    return race?.results_confirmed_at != null && race.scores.length > 0
  }).map((gp) => ({ id: gp.id as string, name: gp.name as string, season: gp.season as number }))
}

// ── Écriture ──────────────────────────────────────────────────────────────

// Phase 1 — insère les scores de base après chaque session
export async function upsertBaseScores(
  sessionId: string,
  leagueId:  string,
  season:    number,
  userScores: { userId: string; score: SessionScore }[],
): Promise<void> {
  const supabase = createServiceClient()
  const now = new Date().toISOString()

  const rows = userScores.map(({ userId, score }) => ({
    user_id:         userId,
    league_id:       leagueId,
    session_id:      sessionId,
    season,
    base_score:      score.baseScore,
    final_score:     score.finalScore,
    exact_positions: score.exactPositions,
    breakdown:       score.breakdown,
    computed_at:     now,
  }))

  const { error } = await supabase
    .from('scores')
    .upsert(rows, { onConflict: 'user_id,league_id,session_id' })

  if (error) throw error
}

// Phase 2 — met à jour final_score après résolution des items
export async function updateFinalScores(
  gpId:     string,
  leagueId: string,
  scores:   Map<ScoreKey, SessionScore>,
): Promise<void> {
  const supabase = createServiceClient()

  // Résolution sessionType → sessionId pour ce GP
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, type')
    .eq('gp_id', gpId)

  if (sessionsError) throw sessionsError
  const idByType = new Map((sessions ?? []).map((s) => [s.type as string, s.id as string]))

  // N UPDATE en parallèle (1 par (user, session)) — valeurs distinctes par ligne,
  // sur des lignes déjà créées en Phase 1. Volume faible (~membres × sessions par
  // GP), exécuté par le cron : un upsert groupé devrait réémettre toutes les
  // colonnes NOT NULL, on garde donc l'UPDATE ciblé. Cf. discussion PR #1.
  await Promise.all(
    Array.from(scores.entries()).map(async ([key, score]) => {
      const [userId, sessionType] = key.split(':')
      const sessionId = idByType.get(sessionType)
      if (!sessionId) return

      const { error } = await supabase
        .from('scores')
        .update({ final_score: score.finalScore, computed_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('league_id', leagueId)
        .eq('session_id', sessionId)
      if (error) throw error
    }),
  )
}

export async function upsertSeasonScores(
  leagueId: string,
  season:   number,
  rows:     SeasonScoreRow[],
): Promise<void> {
  const supabase = createServiceClient()
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('season_scores')
    .upsert(
      rows.map((r) => ({
        user_id:     r.userId,
        league_id:   leagueId,
        season,
        wdc_score:   r.wdcScore,
        wdc_bonus:   r.wdcBonus,
        wcc_score:   r.wccScore,
        wcc_bonus:   r.wccBonus,
        total:       r.wdcScore + r.wdcBonus + r.wccScore + r.wccBonus,
        computed_at: now,
      })),
      { onConflict: 'user_id,league_id,season' },
    )

  if (error) throw error
}

export async function markGPFinalized(gpId: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('grands_prix')
    .update({ scoring_finalized_at: new Date().toISOString() })
    .eq('id', gpId)

  if (error) throw error
}
