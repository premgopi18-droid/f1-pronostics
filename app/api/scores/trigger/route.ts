import 'server-only'
import { getActiveLeagues, getLeagueMembers } from '@/lib/data/leagues'
import {
  getCurrentScoresForGP,
  getPendingItemResolutions,
  getPendingSessionScores,
  markGPFinalized,
  updateFinalScores,
  upsertBaseScores,
} from '@/lib/data/scores'
import { getFastestLapForSession, getPredictionsForSession } from '@/lib/data/predictions'
import { getConstructorDriversMap, getResultsForSession } from '@/lib/data/session-results'
import { getItemsForGP, markItemsResolved } from '@/lib/data/items'
import { getSessionId } from '@/lib/data/f1-sync'
import { computeSessionBaseScore } from '@/lib/scoring/base-score'
import { applyItemEffects } from '@/lib/scoring/resolve-items'
import type { ResolutionContext } from '@/lib/scoring/types'

const CURRENT_SEASON = 2025

function isAuthorized(request: Request): boolean {
  return request.headers.get('x-cron-secret') === process.env.CRON_SECRET
}

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    let sessionsScored = 0
    let gpsFinalized   = 0

    const leagues = await getActiveLeagues(CURRENT_SEASON)

    // ── Phase 1 : scores de base par ligue par session en attente ──────────
    for (const leagueId of leagues) {
      const pendingSessions = await getPendingSessionScores(leagueId)
      if (pendingSessions.length === 0) continue

      const members = await getLeagueMembers(leagueId, CURRENT_SEASON)
      if (members.length === 0) continue

      for (const session of pendingSessions) {
        const [results, predictions, fastestLaps] = await Promise.all([
          getResultsForSession(session.id),
          getPredictionsForSession(session.id),
          getFastestLapForSession(session.id),
        ])

        // Résultats pas encore disponibles (confirmés côté sessions mais pas encore upsertés)
        if (results.size === 0) continue

        const userScores = members.flatMap((userId) => {
          const prediction = predictions.find((p) => p.userId === userId)
          if (!prediction) return []
          const flCode = fastestLaps.get(userId) ?? null
          const score  = computeSessionBaseScore(prediction.entries, flCode, results, session.type)
          return [{ userId, score }]
        })

        if (userScores.length === 0) continue

        await upsertBaseScores(session.id, leagueId, session.season, userScores)
        sessionsScored++
      }
    }

    // ── Phase 2 : résolution des items par GP par ligue ────────────────────
    const pendingGPs = await getPendingItemResolutions()

    for (const gp of pendingGPs) {
      const [raceSessionId, qualSessionId] = await Promise.all([
        getSessionId(gp.id, 'race'),
        getSessionId(gp.id, 'qualifying'),
      ])

      if (!raceSessionId || !qualSessionId) continue

      const [raceResults, qualResults, constructorDrivers] = await Promise.all([
        getResultsForSession(raceSessionId),
        getResultsForSession(qualSessionId),
        getConstructorDriversMap(gp.season),
      ])

      for (const leagueId of leagues) {
        const [items, currentScores] = await Promise.all([
          getItemsForGP(gp.id, leagueId),
          getCurrentScoresForGP(gp.id, leagueId),
        ])

        if (items.length === 0) continue

        const ctx: ResolutionContext = {
          raceResults,
          qualifyingResults: qualResults,
          constructorDrivers,
          leagueId,
          gpId: gp.id,
        }

        applyItemEffects(items, currentScores, ctx)

        await Promise.all([
          updateFinalScores(gp.id, leagueId, currentScores),
          markItemsResolved(items),
        ])
      }

      await markGPFinalized(gp.id)
      gpsFinalized++
    }

    return Response.json({ sessionsScored, gpsFinalized })
  } catch (error) {
    console.error('[api/scores/trigger]', error)
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
