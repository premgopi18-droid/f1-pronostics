import 'server-only'
import { createServiceClient } from '@/lib/supabase'
import { isCronAuthorized } from '@/lib/api/cron'
import type { TablesInsert } from '@/lib/database.types'

// Insère des items de test pour un GP passé (déjà finalisé) et réinitialise
// scoring_finalized_at pour que le trigger les résout au prochain appel.
//
// Scénario selon le nombre de membres dans la ligue :
//   ≥ 2 membres : wild_card (M0 → M1) + shield (M1)
//   ≥ 3 membres : + block_driver (M2 → M1, P1 en qualif)
//   ≥ 4 membres : + double_points (M3, race)
//
// noShield=1 : remplace le shield de M1 par double_points (race) — teste
// l'interaction wild_card + ×2 (vol sur snapshot, puis double du reste).
//
// Appel local :
//   curl -H "x-cron-secret: $CRON_SECRET" \
//     "http://localhost:3000/api/dev/seed-items?season=2026&round=1&leagueId=<id>"
export async function GET(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Not available in production' }, { status: 403 })
  }

  if (!isCronAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url      = new URL(request.url)
  const season   = Number(url.searchParams.get('season'))
  const round    = Number(url.searchParams.get('round'))
  const leagueId = url.searchParams.get('leagueId')

  if (!season || !round || !leagueId) {
    return Response.json(
      { error: 'Paramètres requis : season, round, leagueId' },
      { status: 400 },
    )
  }

  const supabase = createServiceClient()

  // ── GP ────────────────────────────────────────────────────────────────────
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

  // ── Sessions (race + qualifying obligatoires) ─────────────────────────────
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, type')
    .eq('gp_id', gp.id)
    .not('results_confirmed_at', 'is', null)

  const raceSession  = sessions?.find((s) => s.type === 'race')
  const qualSession  = sessions?.find((s) => s.type === 'qualifying')

  if (!raceSession || !qualSession) {
    return Response.json(
      { error: 'Pas de sessions race + qualifying confirmées — lancer le sync d\'abord' },
      { status: 404 },
    )
  }

  // ── Membres de la ligue ───────────────────────────────────────────────────
  const { data: members } = await supabase
    .from('league_members')
    .select('user_id')
    .eq('league_id', leagueId)
    .eq('season', season)
    // Ordre déterministe : M0 = membre le plus ancien → rôles (attaquant/victime)
    // stables d'un replay à l'autre.
    .order('joined_at', { ascending: true })

  if (!members || members.length < 2) {
    return Response.json(
      { error: `La ligue doit avoir ≥ 2 membres (trouvé : ${members?.length ?? 0})` },
      { status: 400 },
    )
  }

  const userIds = members.map((m) => m.user_id)
  const noShield = url.searchParams.get('noShield') === '1'

  // ── P1 en qualif (pour block_driver) ─────────────────────────────────────
  const { data: qualP1 } = await supabase
    .from('session_results')
    .select('drivers!driver_id(code)')
    .eq('session_id', qualSession.id)
    .eq('position', 1)
    .single()

  const qualP1Code = qualP1 ? (qualP1.drivers).code : 'VER'

  // ── Remise à zéro : supprime les items existants + déverrouille le GP ─────
  await supabase.from('items_played').delete().eq('gp_id', gp.id).eq('league_id', leagueId)
  await supabase.from('grands_prix').update({ scoring_finalized_at: null }).eq('id', gp.id)

  // Rejoue la Phase 2 proprement : la Phase 1 ne re-baseline pas les sessions déjà
  // scorées, et la résolution repart de `final_score` (pas de `base_score`). Sans
  // ce reset, un re-seed + re-trigger ré-appliquerait les effets par-dessus les
  // anciens → dérive. On remet donc `final_score = base_score` avant de déverrouiller.
  const sessionIds = sessions!.map((s) => s.id)
  const { data: scoreRows } = await supabase
    .from('scores')
    .select('id, base_score')
    .eq('league_id', leagueId)
    .in('session_id', sessionIds)

  await Promise.all(
    (scoreRows ?? []).map((row) =>
      supabase
        .from('scores')
        .update({ final_score: row.base_score })
        .eq('id', row.id),
    ),
  )

  // ── Items à insérer ───────────────────────────────────────────────────────
  const now = new Date().toISOString()

  type ItemRow = TablesInsert<'items_played'>

  const items: ItemRow[] = [
    // M0 → wild_card sur M1 (race)
    {
      user_id:   userIds[0],
      league_id: leagueId,
      gp_id:     gp.id,
      season,
      item_type: 'wild_card',
      payload:   { target_user_id: userIds[1], session_type: 'race' },
      played_at: now,
    },
    // M1 → shield (défaut) ou double_points (noShield=1)
    // noShield teste l'interaction wild_card + ×2 : vol calculé sur le score
    // original (snapshot), puis M1 double ce qui lui reste.
    {
      user_id:   userIds[1],
      league_id: leagueId,
      gp_id:     gp.id,
      season,
      item_type: noShield ? 'double_points' : 'shield',
      payload:   noShield ? { session_type: 'race' } : {},
      played_at: now,
    },
  ]

  if (userIds.length >= 3) {
    // M2 → block_driver sur M1, session qualif, pilote P1
    items.push({
      user_id:   userIds[2],
      league_id: leagueId,
      gp_id:     gp.id,
      season,
      item_type: 'block_driver',
      payload:   { target_user_id: userIds[1], session_type: 'qualifying', driver_code: qualP1Code },
      played_at: now,
    })
  }

  if (userIds.length >= 4) {
    // M3 → double_points, race
    items.push({
      user_id:   userIds[3],
      league_id: leagueId,
      gp_id:     gp.id,
      season,
      item_type: 'double_points',
      payload:   { session_type: 'race' },
      played_at: now,
    })
  }

  const { error } = await supabase.from('items_played').insert(items)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({
    gp:             gp.name,
    round,
    season,
    leagueId,
    qualP1Code,
    itemsInserted:  items.map((i) => ({ user: i.user_id.slice(0, 8), type: i.item_type })),
    nextStep:       'curl -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/scores/trigger',
  })
}
