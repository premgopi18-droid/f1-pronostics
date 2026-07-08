import { notFound } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'
import { getCachedDrivers, getCachedConstructors } from '@/lib/f1/cached'
import { TEAM_COLORS } from '@/lib/f1/team-colors'
import { t } from '@/lib/i18n'
import type { TranslationKey } from '@/lib/i18n'
import { SCOREABLE_SESSION_TYPES, type SessionType, type BreakdownEntry } from '@/lib/scoring/types'

const SESSION_ORDER: SessionType[] = ['sprint_qualifying', 'qualifying', 'sprint_race', 'race']

const SESSION_LABEL_KEYS: Record<SessionType, TranslationKey> = {
  qualifying:        'home.session.qualifying',
  race:              'home.session.race',
  sprint_qualifying: 'home.session.sprintQualifying',
  sprint_race:       'home.session.sprint',
}

const PODIUM_POSITION_LABELS = ['P1', 'P2', 'P3'] as const

function ordinalFr(n: number): string {
  return n === 1 ? '1er' : `${n}e`
}

export default async function RecapGPPage({
  params,
}: {
  params: Promise<{ gpId: string }>
}) {
  const { gpId } = await params
  const supabase  = await createClient()
  const season    = getCurrentSeason()
  const userId    = (await headers()).get('x-user-id')!

  // Stage 1 — GP, sessions, mes ligues
  const [
    { data: gp },
    { data: sessions },
    { data: myLeagueMemberships },
  ] = await Promise.all([
    supabase
      .from('grands_prix')
      .select('id, name, country, round, season, scoring_finalized_at')
      .eq('id', gpId)
      .single(),
    supabase
      .from('sessions')
      .select('id, type, results_confirmed_at')
      .eq('gp_id', gpId)
      // Essais libres exclus : le récap ne porte que sur les sessions scorées.
      .in('type', SCOREABLE_SESSION_TYPES),
    supabase
      .from('league_members')
      .select('league_id, leagues!league_id(id, name)')
      .eq('user_id', userId)
      .eq('season', season),
  ])

  if (!gp || gp.season !== season) notFound()

  const sessionIds          = (sessions ?? []).map((s) => s.id)
  const confirmedSessionIds = (sessions ?? [])
    .filter((s) => s.results_confirmed_at != null)
    .map((s) => s.id)
  const raceSession         = (sessions ?? []).find((s) => s.type === 'race' && s.results_confirmed_at != null)
  const leagueIds           = (myLeagueMemberships ?? []).map((m) => m.league_id)

  // Stage 2 — scores, podium, FL, tous scores de saison
  const [
    { data: myGpScores },
    { data: podiumRows },
    { data: myFlPrediction },
    { data: actualFlRow },
    { data: allSeasonScores },
    driversCached,
    constructorsCached,
  ] = await Promise.all([
    // Mes scores pour ce GP (toutes ligues)
    sessionIds.length > 0
      ? supabase
          .from('scores')
          .select('league_id, session_id, base_score, final_score, breakdown')
          .eq('user_id', userId)
          .eq('season', season)
          .in('session_id', sessionIds)
      : { data: [] },
    // Podium officiel (course)
    raceSession
      ? supabase
          .from('session_results')
          .select('position, drivers!driver_id(code, constructor_id)')
          .eq('session_id', raceSession.id)
          .lte('position', 3)
          .order('position')
      : { data: [] },
    // Ma prédiction meilleur tour (course)
    raceSession
      ? supabase
          .from('fastest_lap_predictions')
          .select('drivers!driver_id(code)')
          .eq('user_id', userId)
          .eq('session_id', raceSession.id)
          .maybeSingle()
      : { data: null },
    // Résultat réel meilleur tour (course)
    raceSession
      ? supabase
          .from('session_results')
          .select('drivers!driver_id(code)')
          .eq('session_id', raceSession.id)
          .eq('fastest_lap', true)
          .maybeSingle()
      : { data: null },
    // Tous les scores de saison dans mes ligues (pour rang et total saison)
    leagueIds.length > 0
      ? supabase
          .from('scores')
          .select('user_id, league_id, session_id, final_score')
          .eq('season', season)
          .in('league_id', leagueIds)
      : { data: [] },
    getCachedDrivers(season),
    getCachedConstructors(season),
  ])

  // ── Lookups team colors ────────────────────────────────────────────────────

  const constructorCodeById = new Map(
    (constructorsCached ?? []).map((c) => [c.id, c.code]),
  )
  const teamColorByDriverCode = new Map(
    (driversCached ?? []).map((d) => [
      d.code,
      TEAM_COLORS[constructorCodeById.get(d.constructor_id ?? '') ?? ''] ?? '#52525b',
    ]),
  )

  // ── Podium ────────────────────────────────────────────────────────────────

  type PodiumEntry = { code: string; color: string }
  const podium: PodiumEntry[] = (podiumRows ?? []).map((row) => {
    const driver = row.drivers
    const code   = driver?.code ?? '?'
    return { code, color: teamColorByDriverCode.get(code) ?? '#52525b' }
  })

  // ── Mes scores par session (agrégé sur la 1ère ligue disponible — base_score identique) ──

  const typeById = new Map((sessions ?? []).map((s) => [s.id, s.type as SessionType]))

  type SessionRecap = {
    type:        SessionType
    baseScore:   number
    exactCount:  number
    partialCount: number
    hadFl:       boolean
  }

  const sessionRecapMap = new Map<SessionType, SessionRecap>()

  for (const row of myGpScores ?? []) {
    const sessionType = typeById.get(row.session_id)
    if (!sessionType || sessionRecapMap.has(sessionType)) continue

    // Frontière JSONB : `breakdown` est écrit par upsertBaseScores (BreakdownEntry[]),
    // le schéma DB ne connaît que Json — cast assumé au point de lecture.
    const breakdown    = (row.breakdown ?? []) as unknown as BreakdownEntry[]
    const exactCount   = breakdown.filter((e) => e.actualPos !== null && e.predictedPos === e.actualPos).length
    const partialCount = breakdown.filter(
      (e) => e.actualPos !== null && Math.abs(e.predictedPos - e.actualPos) === 1 && e.pts > 0,
    ).length

    sessionRecapMap.set(sessionType, {
      type:         sessionType,
      baseScore:    row.base_score,
      exactCount,
      partialCount,
      hadFl:        false, // rempli ci-dessous pour la course
    })
  }

  // Meilleur tour (course)
  const myFlCode     = (myFlPrediction?.drivers)?.code
  const actualFlCode = (actualFlRow?.drivers)?.code
  const hadFl        = Boolean(myFlCode && myFlCode === actualFlCode)

  if (hadFl) {
    const raceRecap = sessionRecapMap.get('race')
    if (raceRecap) sessionRecapMap.set('race', { ...raceRecap, hadFl: true })
  }

  const orderedSessionRecaps = SESSION_ORDER
    .map((type) => sessionRecapMap.get(type))
    .filter((s): s is SessionRecap => s !== undefined)

  const totalBrut = orderedSessionRecaps.reduce((sum, s) => sum + s.baseScore, 0)
  const hasScores = orderedSessionRecaps.length > 0
  const isDefinitif = gp.scoring_finalized_at != null

  // ── Scores saison par (userId, leagueId) ──────────────────────────────────

  type SeasonTotal = Map<string, number> // userId → total final_score
  const seasonTotalByLeague = new Map<string, SeasonTotal>()

  // Quels session_ids appartiennent à ce GP
  const gpSessionSet = new Set(sessionIds)

  for (const row of allSeasonScores ?? []) {
    const lid = row.league_id
    const uid = row.user_id
    if (!seasonTotalByLeague.has(lid)) seasonTotalByLeague.set(lid, new Map())
    const leagueMap = seasonTotalByLeague.get(lid)!
    leagueMap.set(uid, (leagueMap.get(uid) ?? 0) + (row.final_score))
  }

  // Mon total ce GP par ligue (pour items delta)
  const myGpFinalByLeague = new Map<string, number>()
  for (const row of myGpScores ?? []) {
    const lid = row.league_id
    myGpFinalByLeague.set(lid, (myGpFinalByLeague.get(lid) ?? 0) + (row.final_score))
  }

  // Rang saison par ligue
  function leagueRank(lid: string): { current: number; previous: number; total: number } {
    const leagueMap = seasonTotalByLeague.get(lid)
    if (!leagueMap) return { current: 1, previous: 1, total: 0 }

    const myTotal    = leagueMap.get(userId) ?? 0
    const myGpFinal  = myGpFinalByLeague.get(lid) ?? 0
    const myPrevTotal = myTotal - myGpFinal

    const sorted         = Array.from(leagueMap.values()).sort((a, b) => b - a)
    const sortedPrev     = Array.from(leagueMap.entries())
      .map(([uid, tot]) => tot - (uid === userId ? myGpFinal : (
        // pour les autres, leur total "avant ce GP" = total - leur score ce GP
        (allSeasonScores ?? [])
          .filter((r) => r.user_id === uid && r.league_id === lid && gpSessionSet.has(r.session_id))
          .reduce((s, r) => s + (r.final_score), 0)
      )))
      .sort((a, b) => b - a)

    const current  = sorted.indexOf(myTotal) + 1
    const previous = sortedPrev.indexOf(myPrevTotal) + 1

    return { current, previous, total: myTotal }
  }

  // ── Ligues enrichies ───────────────────────────────────────────────────────

  type LeagueRecap = {
    leagueId:   string
    name:       string
    gpBrut:     number
    itemsDelta: number
    gpFinal:    number
    season:     number
    rank:       number
    rankDelta:  number
  }

  const leagueRecaps: LeagueRecap[] = (myLeagueMemberships ?? [])
    .map((m) => {
      const league  = m.leagues
      const lid     = m.league_id
      const gpFinal = myGpFinalByLeague.get(lid) ?? 0
      const { current, previous, total } = leagueRank(lid)

      return {
        leagueId:   lid,
        name:       league?.name ?? '?',
        gpBrut:     totalBrut,
        itemsDelta: gpFinal - totalBrut,
        gpFinal,
        season:     total,
        rank:       current,
        rankDelta:  previous - current,
      }
    })
    .filter((l) => l.gpFinal > 0 || hasScores)

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="max-w-lg mx-auto flex flex-col gap-8">

        {/* Header */}
        <div className="flex flex-col gap-1">
          <Link
            href="/predictions"
            className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            ← {t('recap.back')}
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider">
                {t('home.round')} {gp.round} · {gp.country}
              </p>
              <h1 className="text-2xl font-bold text-white">{gp.name}</h1>
            </div>
            {hasScores && (
              <span
                className={`mt-1 shrink-0 text-xs px-2 py-1 rounded-full ${
                  isDefinitif
                    ? 'bg-success-soft text-success'
                    : 'bg-warning-soft text-warning'
                }`}
              >
                {isDefinitif ? t('recap.badgeDefinitif') : t('recap.badgeProvisoire')}
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500">
            {isDefinitif ? t('recap.subtitleDefinitif') : t('recap.subtitleProvisoire')}
          </p>
        </div>

        {/* Podium officiel */}
        {podium.length === 3 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
              {t('recap.podiumTitle')}
            </h2>
            <div className="flex items-end justify-center gap-4">
              {/* P2 — argent (affiché en 2e visuellement mais position centrale-gauche) */}
              {[1, 0, 2].map((podiumIdx, visualIdx) => {
                const entry    = podium[podiumIdx]
                const heights  = ['h-16', 'h-20', 'h-12'] as const
                const bgColors = ['bg-zinc-400/20', 'bg-yellow-400/20', 'bg-orange-700/20'] as const
                const textColors = ['text-zinc-300', 'text-yellow-300', 'text-orange-400'] as const

                return (
                  <div key={podiumIdx} className="flex flex-col items-center gap-2">
                    {/* Cercle team color */}
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: entry.color }}
                      aria-label={entry.code}
                    >
                      {entry.code}
                    </div>
                    {/* Podium block */}
                    <div
                      className={`${heights[visualIdx]} w-20 ${bgColors[visualIdx]} rounded-t-lg flex items-center justify-center`}
                    >
                      <span className={`text-sm font-bold ${textColors[visualIdx]}`}>
                        {PODIUM_POSITION_LABELS[podiumIdx]}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Score de prédiction */}
        {hasScores && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                {t('recap.scoreTitle')}
              </h2>
              {hasScores && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    isDefinitif
                      ? 'bg-success-soft text-success'
                      : 'bg-warning-soft text-warning'
                  }`}
                >
                  {isDefinitif ? t('recap.badgeDefinitif') : t('recap.badgeProvisoire')}
                </span>
              )}
            </div>
            <div className="bg-zinc-900 rounded-xl divide-y divide-zinc-800">
              {orderedSessionRecaps.map((session) => (
                <div key={session.type} className="flex items-start justify-between px-4 py-3 gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-white">
                      {t(SESSION_LABEL_KEYS[session.type])}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {session.exactCount > 0 && (
                        <>{session.exactCount} {t('recap.exactes')}</>
                      )}
                      {session.partialCount > 0 && (
                        <> · {session.partialCount} {t('recap.plusMinusUn')}</>
                      )}
                      {session.type === 'race' && session.hadFl && (
                        <> · {t('recap.meilleurTour')} ✓</>
                      )}
                    </span>
                  </div>
                  <span className="text-white font-semibold tabular-nums shrink-0">
                    {session.baseScore} {t('recap.pts')}
                  </span>
                </div>
              ))}

              {/* Total brut */}
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-semibold text-white">{t('recap.totalBrut')}</span>
                <span className="text-lg font-bold text-destructive tabular-nums">
                  {totalBrut} {t('recap.pts')}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Aucun score */}
        {!hasScores && (
          <p className="text-zinc-500 text-sm">{t('recap.noScore')}</p>
        )}

        {/* Dans mes ligues */}
        {leagueRecaps.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
              {t('recap.dansMesLigues')}
            </h2>
            <div className="flex flex-col gap-2">
              {leagueRecaps.map((league) => (
                <Link
                  key={league.leagueId}
                  href={`/leagues/${league.leagueId}/gp/${gpId}`}
                  className="bg-zinc-900 rounded-xl px-4 py-3 flex flex-col gap-2 hover:bg-zinc-800 transition-colors"
                >
                  <span className="text-sm font-medium text-white">{league.name}</span>
                  <div className="flex items-center gap-2 text-sm tabular-nums">
                    <span className="text-zinc-300 font-semibold">{league.gpBrut}</span>
                    {league.itemsDelta !== 0 && (
                      <>
                        <span className="text-zinc-600">→</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            league.itemsDelta > 0
                              ? 'bg-success-soft text-success'
                              : 'bg-destructive-soft text-destructive'
                          }`}
                        >
                          {league.itemsDelta > 0 ? '+' : ''}{league.itemsDelta}
                        </span>
                      </>
                    )}
                    <span className="text-zinc-600">→</span>
                    <span className="text-white font-bold">
                      {league.season} {t('recap.pts')}
                    </span>
                  </div>
                  {league.rankDelta !== 0 && (
                    <p className="text-xs text-zinc-500">
                      {league.rankDelta > 0
                        ? `${t('recap.rankUp')} ${league.rankDelta} · `
                        : `${t('recap.rankDown')} ${Math.abs(league.rankDelta)} · `}
                      {t('recap.rankPasses')} {ordinalFr(league.rank)} {t('recap.rankOf')}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA résultats officiels */}
        {confirmedSessionIds.length > 0 && (
          <Link
            href={`/results`}
            className="flex items-center justify-center px-4 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 transition-colors text-sm text-zinc-300"
          >
            {t('recap.voirResultats')}
          </Link>
        )}

      </div>
    </main>
  )
}
