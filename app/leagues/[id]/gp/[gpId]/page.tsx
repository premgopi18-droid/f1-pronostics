import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'
import type { SessionType } from '@/lib/scoring/types'

const SESSION_ORDER: SessionType[] = ['sprint_qualifying', 'qualifying', 'sprint_race', 'race']

const SESSION_LABELS: Record<SessionType, string> = {
  qualifying:        'Qualifications',
  race:              'Course',
  sprint_qualifying: 'Sprint Qualifying',
  sprint_race:       'Sprint Race',
}

// Ligne de classement partagée par « Total GP » et le détail par session.
// `emphasis` : pseudo en gras (total) vs plus discret (session).
function ScoreRow({
  rank,
  pseudo,
  points,
  exactPositions,
  isMe,
  isDeleted,
  emphasis,
}: {
  rank:           number
  pseudo:         string
  points:         number
  exactPositions: number
  isMe:           boolean
  isDeleted:      boolean
  emphasis:       boolean
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
        isMe ? 'bg-zinc-800' : 'bg-zinc-900'
      } ${isDeleted ? 'opacity-50' : ''}`}
    >
      <span className="text-zinc-500 text-sm w-5 text-right">{rank}</span>
      <span className={`flex-1 ${emphasis ? 'font-medium' : 'text-sm'} ${isDeleted ? 'text-zinc-500' : 'text-white'}`}>
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

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
      .select('user_id, profiles!user_id(pseudo, is_deleted)')
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

  const { data: scoreRows } = sessionIds.length > 0
    ? await supabase
        .from('scores')
        .select('user_id, session_id, final_score, exact_positions')
        .eq('league_id', leagueId)
        .eq('season', season)
        .in('session_id', sessionIds)
    : { data: [] }

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
    isDeleted:  boolean
    isMe:       boolean
    total:      number
    exactTotal: number
    bySession:  Partial<Record<SessionType, { finalScore: number; exactPositions: number }>>
  }

  const memberScores: MemberScore[] = (members ?? [])
    .map((m) => {
      const profile = (m.profiles as unknown) as { pseudo: string; is_deleted: boolean } | null
      const userId  = m.user_id as string
      const bySession: Partial<Record<SessionType, { finalScore: number; exactPositions: number }>> = {}
      let total      = 0
      let exactTotal = 0

      for (const sType of orderedSessionTypes) {
        const score = scoreMap.get(`${userId}:${sType}`)
        if (score) {
          bySession[sType] = score
          total      += score.finalScore
          exactTotal += score.exactPositions
        }
      }

      return {
        userId,
        pseudo:    profile?.is_deleted ? 'Compte supprimé' : (profile?.pseudo ?? '?'),
        isDeleted: profile?.is_deleted ?? false,
        isMe:      userId === user.id,
        total,
        exactTotal,
        bySession,
      }
    })
    .sort((a, b) => {
      if (a.isDeleted !== b.isDeleted) return a.isDeleted ? 1 : -1
      return b.total - a.total || b.exactTotal - a.exactTotal
    })

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
                  isDeleted={m.isDeleted}
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
              if (a.isDeleted !== b.isDeleted) return a.isDeleted ? 1 : -1
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
                      isDeleted={m.isDeleted}
                      emphasis={false}
                    />
                  )
                })}
              </div>
            </section>
          )
        })}

      </div>
    </main>
  )
}
