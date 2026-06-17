import 'server-only'
import { createServiceClient } from '@/lib/supabase'
import { isCronAuthorized } from '@/lib/api/cron'
import { POSITIONS_TO_SCORE } from '@/lib/scoring/constants'
import type { SessionType } from '@/lib/scoring/types'

// Insère des prédictions de test pour un GP passé (résultats déjà confirmés).
// Prédit les vrais résultats avec quelques swaps aléatoires → mix ✓/±N/✗ réaliste.
// Double garde : jamais en production (NODE_ENV) + secret cron exigé même en local.
// Appel local : `curl -H "x-cron-secret: $CRON_SECRET" ".../api/dev/seed-predictions?season=&round=&userId="`.
export async function GET(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Not available in production' }, { status: 403 })
  }

  if (!isCronAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url    = new URL(request.url)
  const season = Number(url.searchParams.get('season'))
  const round  = Number(url.searchParams.get('round'))
  const userId = url.searchParams.get('userId')

  if (!season || !round || !userId) {
    return Response.json(
      { error: 'Paramètres requis : season, round, userId' },
      { status: 400 },
    )
  }

  const supabase = createServiceClient()

  const { data: gp } = await supabase
    .from('grands_prix')
    .select('id, name')
    .eq('season', season)
    .eq('round', round)
    .single()

  if (!gp) {
    return Response.json(
      { error: `GP introuvable : season=${season} round=${round}` },
      { status: 404 },
    )
  }

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, type')
    .eq('gp_id', gp.id)
    .not('results_confirmed_at', 'is', null)

  if (!sessions?.length) {
    return Response.json(
      { error: 'Aucune session confirmée pour ce GP — lancer le sync d\'abord' },
      { status: 404 },
    )
  }

  const seeded: string[] = []

  for (const session of sessions) {
    const sessionType      = session.type as SessionType
    const positionsToScore = POSITIONS_TO_SCORE[sessionType]

    const { data: results } = await supabase
      .from('session_results')
      .select('position, fastest_lap, driver_id, drivers!driver_id(code)')
      .eq('session_id', session.id)
      .not('position', 'is', null)
      .order('position', { ascending: true })
      .limit(positionsToScore)

    if (!results?.length) continue

    type ResultRow = { position: number; fastest_lap: boolean; driver_id: string; drivers: { code: string } }
    const rows = results as unknown as ResultRow[]

    // Codes dans l'ordre réel (P1 → PN)
    const entries = rows.map((r) => r.drivers.code)

    // Swaps adjacents — donne un mix ✓ / ±1 / ±2
    const numAdjacentSwaps = Math.ceil(positionsToScore / 5)
    for (let i = 0; i < numAdjacentSwaps; i++) {
      const idx = Math.floor(Math.random() * (entries.length - 1))
      ;[entries[idx], entries[idx + 1]] = [entries[idx + 1], entries[idx]]
    }

    // Un swap "lointain" (±3) pour avoir quelques ✗ francs
    if (entries.length > 4) {
      const idx = Math.floor(Math.random() * (entries.length - 3))
      ;[entries[idx], entries[idx + 3]] = [entries[idx + 3], entries[idx]]
    }

    const { error: predError } = await supabase
      .from('predictions')
      .upsert(
        {
          user_id:      userId,
          session_id:   session.id,
          season,
          entries,
          is_valid:     true,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,session_id' },
      )

    if (predError) throw predError
    seeded.push(sessionType)

    // Fastest lap — uniquement pour la course (fastest_lap_predictions ⊂ race,
    // et le scoring ne crédite le tour rapide que pour `race`) : 50 % correct, 50 % le P3
    if (sessionType === 'race') {
      const flRow    = rows.find((r) => r.fastest_lap) ?? rows[2]
      const wrongRow = rows[2] ?? rows[0]
      const chosen   = Math.random() > 0.5 ? flRow : wrongRow

      if (chosen) {
        const { error: flError } = await supabase
          .from('fastest_lap_predictions')
          .upsert(
            {
              user_id:      userId,
              session_id:   session.id,
              season,
              driver_id:    chosen.driver_id,
              submitted_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,session_id' },
          )
        if (flError) throw flError
      }
    }
  }

  return Response.json({ gp: gp.name, sessionsSeeded: seeded })
}
