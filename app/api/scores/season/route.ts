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

    // Garde-fou : classements officiels indisponibles (mauvaise année via F1_SEASON,
    // saison non terminée, incident Jolpica). Sans ça, computeSeasonScore ne trouverait
    // aucune position → scores à 0 écrasant season_scores, masqués derrière un 200.
    // WDC et WCC coexistent toujours en fin de saison : si l'un OU l'autre est vide,
    // c'est une anomalie — on refuse d'écrire des zéros sur ce championnat.
    if (driverStandings.size === 0 || constructorStandings.size === 0) {
      return Response.json({ error: 'Classements officiels indisponibles' }, { status: 503 })
    }

    let leaguesScored = 0

    for (const leagueId of leagues) {
      // N+1 assumé : 1 requête membres par ligue. Volume faible (membres × ligues
      // actives), exécuté hors ligne sur une route déclenchée une fois par saison —
      // même pattern que /api/scores/trigger. Pas d'optimisation prématurée ici.
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

    // Compteurs globaux (toutes ligues confondues), pas par ligue scorée — métriques
    // de contrôle pour vérifier que les prédictions ont bien été chargées.
    return Response.json({
      leaguesScored,
      totalWdcPredictions: wdcPredictions.size,
      totalWccPredictions: wccPredictions.size,
    })
  } catch (error) {
    console.error('[api/scores/season]', error)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const GET  = handler
export const POST = handler
