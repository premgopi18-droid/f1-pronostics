import { notFound } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'
import { FASTEST_LAP_BONUS, POSITIONS_TO_SCORE, SCORE_TABLES } from '@/lib/scoring/constants'
import type { SessionType } from '@/lib/scoring/types'

const SESSION_ORDER: SessionType[] = ['sprint_qualifying', 'qualifying', 'sprint_race', 'race']

const SESSION_LABELS: Record<SessionType, string> = {
  qualifying:        'Qualifications',
  race:              'Course',
  sprint_qualifying: 'Sprint Qualifying',
  sprint_race:       'Sprint Race',
}

// Ligne de classement partagée par « Total GP » et le détail par session.
function ScoreRow({
  rank,
  pseudo,
  points,
  exactPositions,
  isMe,
  emphasis,
}: {
  rank:           number
  pseudo:         string
  points:         number
  exactPositions: number
  isMe:           boolean
  emphasis:       boolean
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
        isMe ? 'bg-zinc-800' : 'bg-zinc-900'
      }`}
    >
      <span className="text-zinc-500 text-sm w-5 text-right">{rank}</span>
      <span className={`flex-1 ${emphasis ? 'font-medium' : 'text-sm'} text-white`}>
        {pseudo}
      </span>
      <span className="text-white font-semibold tabular-nums">{points} pts</span>
      {exactPositions > 0 && (
        <span className="text-zinc-500 text-xs tabular-nums ml-1">{exactPositions}✓</span>
      )}
    </div>
  )
}

export default async function GPScoresPage({
  params,
}: {
  params: Promise<{ id: string; gpId: string }>
}) {
  const { id: leagueId, gpId } = await params
  const supabase = await createClient()
  const season   = getCurrentSeason()
  const userId   = (await headers()).get('x-user-id')!

  // Stage 1 — données de base du GP
  const [
    { data: gp },
    { data: sessions },
    { data: members },
    { data: league },
  ] = await Promise.all([
    supabase
      .from('grands_prix')
      .select('id, name, country, round, season, scoring_finalized_at')
      .eq('id', gpId)
      .single(),
    supabase
      .from('sessions')
      .select('id, type, results_confirmed_at')
      .eq('gp_id', gpId),
    supabase
      .from('league_members')
      .select('user_id, profiles!user_id(pseudo)')
      .eq('league_id', leagueId)
      .eq('season', season),
    supabase
      .from('leagues')
      .select('id, name')
      .eq('id', leagueId)
      .single(),
  ])

  if (!gp || !league || gp.season !== season) notFound()

  const sessionIds = (sessions ?? []).map((s) => s.id as string)
  const confirmedSessionIds = (sessions ?? [])
    .filter((s) => s.results_confirmed_at != null)
    .map((s) => s.id as string)

  // Stage 2 — scores + pronostics + résultats en parallèle (était 2 étapes séquentielles)
  const [
    { data: scoreRows },
    { data: predRowsData },
    { data: flRowsData },
    { data: resultRowsData },
  ] = await Promise.all([
    sessionIds.length > 0
      ? supabase
          .from('scores')
          .select('user_id, session_id, final_score, exact_positions')
          .eq('league_id', leagueId)
          .eq('season', season)
          .in('session_id', sessionIds)
      : { data: [] },
    confirmedSessionIds.length > 0
      ? supabase
          .from('predictions')
          .select('session_id, entries, is_valid')
          .eq('user_id', userId)
          .in('session_id', confirmedSessionIds)
      : { data: [] },
    confirmedSessionIds.length > 0
      ? supabase
          .from('fastest_lap_predictions')
          .select('session_id, drivers!driver_id(code)')
          .eq('user_id', userId)
          .in('session_id', confirmedSessionIds)
      : { data: [] },
    confirmedSessionIds.length > 0
      ? supabase
          .from('session_results')
          .select('session_id, position, fastest_lap, drivers!driver_id(code)')
          .in('session_id', confirmedSessionIds)
          .not('position', 'is', null)
      : { data: [] },
  ])

  const typeById = new Map((sessions ?? []).map((s) => [s.id as string, s.type as SessionType]))

  const scoreMap = new Map<string, { finalScore: number; exactPositions: number }>()
  for (const row of scoreRows ?? []) {
    const sessionType = typeById.get(row.session_id as string)
    if (!sessionType) continue
    scoreMap.set(`${row.user_id}:${sessionType}`, {
      finalScore:     row.final_score as number,
      exactPositions: row.exact_positions as number,
    })
  }

  const orderedSessionTypes = SESSION_ORDER.filter((t) =>
    (sessions ?? []).some((s) => s.type === t),
  )

  type MemberScore = {
    userId:     string
    pseudo:     string
    isMe:       boolean
    total:      number
    exactTotal: number
    bySession:  Partial<Record<SessionType, { finalScore: number; exactPositions: number }>>
  }

  const memberScores: MemberScore[] = (members ?? [])
    .map((m) => {
      const profile = (m.profiles as unknown) as { pseudo: string } | null
      const memberId = m.user_id as string
      const bySession: Partial<Record<SessionType, { finalScore: number; exactPositions: number }>> = {}
      let total      = 0
      let exactTotal = 0

      for (const sType of orderedSessionTypes) {
        const score = scoreMap.get(`${memberId}:${sType}`)
        if (score) {
          bySession[sType] = score
          total      += score.finalScore
          exactTotal += score.exactPositions
        }
      }

      return {
        userId:    memberId,
        pseudo:    profile?.pseudo ?? '?',
        isMe:      memberId === userId,
        total,
        exactTotal,
        bySession,
      }
    })
    .sort((a, b) => b.total - a.total || b.exactTotal - a.exactTotal)

  // ── Pronostics vs résultats réels ────────────────────────────────────────

  const userPredictionsBySession  = new Map<string, string[]>()
  const invalidPredictionSessions = new Set<string>()
  const userFLBySession           = new Map<string, string>()
  const actualResultsBySession    = new Map<string, Map<string, number>>()
  const actualFLBySession         = new Map<string, string>()

  for (const row of predRowsData ?? []) {
    const sid = row.session_id as string
    if (row.is_valid) userPredictionsBySession.set(sid, row.entries as string[])
    else invalidPredictionSessions.add(sid)
  }

  for (const row of flRowsData ?? []) {
    const driver = (row.drivers as unknown) as { code: string } | null
    if (driver) userFLBySession.set(row.session_id as string, driver.code)
  }

  for (const row of resultRowsData ?? []) {
    const driver = (row.drivers as unknown) as { code: string } | null
    if (!driver) continue
    const sid      = row.session_id as string
    const position = row.position as number
    if (!actualResultsBySession.has(sid)) actualResultsBySession.set(sid, new Map())
    actualResultsBySession.get(sid)!.set(driver.code, position)
    if (row.fastest_lap) actualFLBySession.set(sid, driver.code)
  }

  const hasScores   = (scoreRows ?? []).length > 0
  const isDefinitif = gp.scoring_finalized_at != null

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="max-w-lg mx-auto flex flex-col gap-8">

        {/* Header */}
        <div className="flex flex-col gap-1">
          <Link
            href={`/leagues/${leagueId}`}
            className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            ← {league.name as string}
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider">
                Round {gp.round} · {gp.country}
              </p>
              <h1 className="text-2xl font-bold text-white">{gp.name as string}</h1>
            </div>
            {hasScores && (
              <span
                className={`mt-1 shrink-0 text-xs px-2 py-1 rounded-full ${
                  isDefinitif
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-amber-500/10 text-amber-400'
                }`}
              >
                {isDefinitif ? 'Définitif' : 'Provisoire'}
              </span>
            )}
          </div>
        </div>

        {/* Lien items */}
        <Link
          href={`/leagues/${leagueId}/gp/${gpId}/items`}
          className="flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 transition-colors"
        >
          <span className="text-white text-sm font-medium">🎮 Jouer un item</span>
          <span className="text-zinc-600 text-xs">→</span>
        </Link>

        {/* Aucun score */}
        {!hasScores && (
          <p className="text-zinc-500 text-sm">
            Aucun score pour ce GP. Les scores apparaissent dès qu&apos;une session est confirmée.
          </p>
        )}

        {/* Total GP */}
        {hasScores && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Total GP</h2>
            <div className="flex flex-col gap-1">
              {memberScores.map((m, i) => (
                <ScoreRow
                  key={m.userId}
                  rank={i + 1}
                  pseudo={m.pseudo}
                  points={m.total}
                  exactPositions={m.exactTotal}
                  isMe={m.isMe}
                  emphasis
                />
              ))}
            </div>
          </section>
        )}

        {/* Par session */}
        {hasScores && orderedSessionTypes.map((sessionType) => {
          const membersWithScore = memberScores
            .filter((m) => m.bySession[sessionType] != null)
            .sort((a, b) => {
              const sa = a.bySession[sessionType]!
              const sb = b.bySession[sessionType]!
              return sb.finalScore - sa.finalScore || sb.exactPositions - sa.exactPositions
            })

          if (membersWithScore.length === 0) return null

          return (
            <section key={sessionType} className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                {SESSION_LABELS[sessionType]}
              </h2>
              <div className="flex flex-col gap-1">
                {membersWithScore.map((m, i) => {
                  const score = m.bySession[sessionType]!
                  return (
                    <ScoreRow
                      key={m.userId}
                      rank={i + 1}
                      pseudo={m.pseudo}
                      points={score.finalScore}
                      exactPositions={score.exactPositions}
                      isMe={m.isMe}
                      emphasis={false}
                    />
                  )
                })}
              </div>
            </section>
          )
        })}

        {/* Mes pronostics vs résultats */}
        {confirmedSessionIds.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
              Mes pronostics
            </h2>
            {orderedSessionTypes
              .filter((type) =>
                (sessions ?? []).some((s) => s.type === type && s.results_confirmed_at != null),
              )
              .map((sessionType) => {
                const session = (sessions ?? []).find((s) => s.type === sessionType)
                if (!session) return null

                const sid              = session.id as string
                const predictedEntries = userPredictionsBySession.get(sid)
                const actualResults    = actualResultsBySession.get(sid) ?? new Map<string, number>()
                const predictedFL      = userFLBySession.get(sid)
                const actualFL         = actualFLBySession.get(sid)
                const scoreTable       = SCORE_TABLES[sessionType] as Record<number, number>
                const positionsToScore = POSITIONS_TO_SCORE[sessionType]

                // position réelle → code pilote (pour afficher qui était là sur une miss)
                const positionToDriver = new Map<number, string>()
                for (const [code, pos] of actualResults) positionToDriver.set(pos, code)

                if (!predictedEntries) {
                  const wasInvalid = invalidPredictionSessions.has(sid)
                  return (
                    <div key={sessionType} className="flex flex-col gap-2">
                      <h3 className="text-xs font-medium text-zinc-500">
                        {SESSION_LABELS[sessionType]}
                      </h3>
                      <p className="text-zinc-600 text-xs px-1">
                        {wasInvalid ? 'Pronostic invalide' : 'Aucun pronostic soumis'}
                      </p>
                    </div>
                  )
                }

                return (
                  <div key={sessionType} className="flex flex-col gap-2">
                    <h3 className="text-xs font-medium text-zinc-500">
                      {SESSION_LABELS[sessionType]}
                    </h3>
                    <div className="flex flex-col gap-0.5">
                      {predictedEntries.slice(0, positionsToScore).map((predictedCode, i) => {
                        const predictedPos = i + 1
                        const actualPos    = actualResults.get(predictedCode)
                        const delta        = actualPos !== undefined
                          ? Math.abs(predictedPos - actualPos)
                          : undefined
                        const pts          = delta !== undefined ? (scoreTable[delta] ?? 0) : 0
                        const actualAtPos  = positionToDriver.get(predictedPos)
                        const isExact      = delta === 0
                        const isPartial    = delta !== undefined && delta > 0 && pts > 0

                        return (
                          <div
                            key={i}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 text-xs"
                          >
                            <span className="text-zinc-600 w-5 text-right tabular-nums">
                              P{predictedPos}
                            </span>
                            <span className={`font-mono w-9 ${isExact ? 'text-white' : 'text-zinc-300'}`}>
                              {predictedCode}
                            </span>
                            {isExact ? (
                              <span className="text-emerald-400">✓</span>
                            ) : isPartial ? (
                              <span className="text-amber-400">±{delta}</span>
                            ) : (
                              <>
                                <span className="text-zinc-600">✗</span>
                                {actualAtPos && (
                                  <span className="text-zinc-500 font-mono">{actualAtPos}</span>
                                )}
                              </>
                            )}
                            <span
                              className={`ml-auto tabular-nums font-medium ${
                                pts > 0 ? 'text-white' : 'text-zinc-700'
                              }`}
                            >
                              {pts > 0 ? `+${pts}` : '—'}
                            </span>
                          </div>
                        )
                      })}

                      {/* Meilleur tour — course uniquement */}
                      {sessionType === 'race' && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 text-xs mt-0.5">
                          <span className="text-zinc-600 w-5 text-right">FL</span>
                          <span
                            className={`font-mono w-9 ${
                              predictedFL && predictedFL === actualFL ? 'text-white' : 'text-zinc-300'
                            }`}
                          >
                            {predictedFL ?? '—'}
                          </span>
                          {predictedFL && predictedFL === actualFL ? (
                            <span className="text-emerald-400">✓</span>
                          ) : (
                            <>
                              <span className="text-zinc-600">✗</span>
                              {actualFL && (
                                <span className="text-zinc-500 font-mono">{actualFL}</span>
                              )}
                            </>
                          )}
                          <span
                            className={`ml-auto tabular-nums font-medium ${
                              predictedFL && predictedFL === actualFL ? 'text-white' : 'text-zinc-700'
                            }`}
                          >
                            {predictedFL && predictedFL === actualFL ? `+${FASTEST_LAP_BONUS}` : '—'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
          </section>
        )}

      </div>
    </main>
  )
}
