import 'server-only'
import { fetchDriverStandings, fetchConstructorStandings } from '@/lib/f1/jolpica'
import { getAllSeasonPredictions } from '@/lib/data/season-predictions'
import { getActiveLeagues, getLeagueMembers } from '@/lib/data/leagues'
import { upsertSeasonScores } from '@/lib/data/scores'
import { computeSeasonScore } from '@/lib/scoring/season-score'
import { getCurrentSeason, isCronAuthorized } from '@/lib/api/cron'

// Accepte GET (crons Vercel) et POST (cron-job.org, curl manuel).
// À déclencher une fois par saison après publication des résultats officiels WDC/WCC.
async function handler(request: Request): Promise<Response> {
  if (!isCronAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const season = getCurrentSeason()

  try {
    const [driverStandings, constructorStandings, wdcPredictions, wccPredictions, leagues] =
      await Promise.all([
        fetchDriverStandings(season),
        fetchConstructorStandings(season),
        getAllSeasonPredictions(season, 'wdc'),
        getAllSeasonPredictions(season, 'wcc'),
        getActiveLeagues(season),
      ])

    let leaguesScored = 0

    for (const leagueId of leagues) {
      const members = await getLeagueMembers(leagueId, season)
      if (members.length === 0) continue

      const rows = members.map((userId) => {
        const wdcEntries = wdcPredictions.get(userId) ?? []
        const wccEntries = wccPredictions.get(userId) ?? []

        const wdc = wdcEntries.length > 0
          ? computeSeasonScore(wdcEntries, driverStandings)
          : { score: 0, bonus: 0 }
        const wcc = wccEntries.length > 0
          ? computeSeasonScore(wccEntries, constructorStandings)
          : { score: 0, bonus: 0 }

        return {
          userId,
          wdcScore: wdc.score,
          wdcBonus: wdc.bonus,
          wccScore: wcc.score,
          wccBonus: wcc.bonus,
        }
      })

      await upsertSeasonScores(leagueId, season, rows)
      leaguesScored++
    }

    return Response.json({
      leaguesScored,
      usersWithWdc: wdcPredictions.size,
      usersWithWcc: wccPredictions.size,
    })
  } catch (error) {
    console.error('[api/scores/season]', error)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const GET  = handler
export const POST = handler
