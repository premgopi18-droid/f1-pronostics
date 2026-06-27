import { notFound } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'
import { t } from '@/lib/i18n'
import { SCOREABLE_SESSION_TYPES, type SessionType } from '@/lib/scoring/types'
import {
  PredictionCompareClient,
  type MemberData,
  type SessionInfo,
} from './prediction-compare-client'

const SESSION_ORDER: SessionType[] = ['sprint_qualifying', 'qualifying', 'sprint_race', 'race']

export default async function PredictionComparePage({
  params,
}: {
  params: Promise<{ id: string; gpId: string }>
}) {
  const { id: leagueId, gpId } = await params
  const supabase  = await createClient()
  const season    = getCurrentSeason()
  const userId    = (await headers()).get('x-user-id')!
  const now       = new Date().toISOString()

  // Stage 1 — GP, sessions, ligue, membres
  const [
    { data: gp },
    { data: sessions },
    { data: league },
    { data: members },
  ] = await Promise.all([
    supabase
      .from('grands_prix')
      .select('id, name, country, round, season')
      .eq('id', gpId)
      .single(),
    supabase
      .from('sessions')
      .select('id, type, starts_at, results_confirmed_at')
      .eq('gp_id', gpId)
      // Essais libres exclus : la comparaison ne porte que sur les sessions scorées.
      .in('type', SCOREABLE_SESSION_TYPES),
    supabase
      .from('leagues')
      .select('id, name')
      .eq('id', leagueId)
      .single(),
    supabase
      .from('league_members')
      .select('user_id, profiles!user_id(pseudo)')
      .eq('league_id', leagueId)
      .eq('season', season),
  ])

  if (!gp || !league || gp.season !== season) notFound()

  // Sessions verrouillées (starts_at <= maintenant) — les pronos sont visibles
  const lockedSessions = (sessions ?? []).filter(
    (s) => s.starts_at != null && (s.starts_at as string) <= now,
  )
  const lockedSessionIds = lockedSessions.map((s) => s.id as string)

  if (lockedSessionIds.length === 0) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-8">
        <div className="max-w-lg mx-auto flex flex-col gap-8">
          <div className="flex flex-col gap-1">
            <Link
              href={`/leagues/${leagueId}/gp/${gpId}`}
              className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
            >
              ← {t('compare.back')}
            </Link>
            <h1 className="text-2xl font-bold text-white">{gp.name as string}</h1>
          </div>
          <p className="text-zinc-500 text-sm">{t('compare.noSessionsLocked')}</p>
        </div>
      </main>
    )
  }

  // Stage 2 — toutes les prédictions + résultats officiels pour les sessions verrouillées
  const [
    { data: allPredictions },
    { data: allResults },
  ] = await Promise.all([
    supabase
      .from('predictions')
      .select('user_id, session_id, entries, is_valid')
      .in('session_id', lockedSessionIds),
    supabase
      .from('session_results')
      .select('session_id, position, drivers!driver_id(code)')
      .in('session_id', lockedSessionIds)
      .not('position', 'is', null)
      .order('position'),
  ])

  // ── Résultats officiels par session ────────────────────────────────────────

  const officialResults: Record<string, string[]> = {}
  for (const row of allResults ?? []) {
    const sid    = row.session_id as string
    const driver = (row.drivers as unknown) as { code: string } | null
    if (!driver) continue
    if (!officialResults[sid]) officialResults[sid] = []
    officialResults[sid].push(driver.code)
  }

  // ── Prédictions par (userId, sessionId) ───────────────────────────────────

  const predMap = new Map<string, string[]>()  // `${userId}:${sessionId}` → entries
  for (const row of allPredictions ?? []) {
    if (!row.is_valid) continue
    predMap.set(`${row.user_id}:${row.session_id}`, row.entries as string[])
  }

  // FL prédictions par (userId, sessionId) — non utilisé dans la vue actuelle mais prévu
  // pour l'extension FL dans GroupView

  // ── Sessions info ──────────────────────────────────────────────────────────

  const sessionInfos: SessionInfo[] = SESSION_ORDER
    .map((type) => lockedSessions.find((s) => s.type === type))
    .filter((s): s is NonNullable<typeof s> => s != null)
    .map((s) => ({
      id:          s.id as string,
      type:        s.type as SessionType,
      isConfirmed: s.results_confirmed_at != null,
    }))

  // ── Membres enrichis ───────────────────────────────────────────────────────

  const memberData: MemberData[] = (members ?? []).map((m) => {
    const profile = (m.profiles as unknown) as { pseudo: string } | null
    const uid     = m.user_id as string

    const predictions: Record<string, string[]> = {}
    for (const sessionInfo of sessionInfos) {
      const entries = predMap.get(`${uid}:${sessionInfo.id}`)
      if (entries) predictions[sessionInfo.id] = entries
    }

    return {
      userId:      uid,
      pseudo:      profile?.pseudo ?? '?',
      isMe:        uid === userId,
      predictions,
    }
  })

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="max-w-lg mx-auto flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-col gap-1">
          <Link
            href={`/leagues/${leagueId}/gp/${gpId}`}
            className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            ← {t('compare.back')}
          </Link>
          <h1 className="text-xl font-bold text-white">
            {t('compare.title')} · {gp.name as string}
          </h1>
          <p className="text-xs text-zinc-500">{t('compare.visibleAfterLock')}</p>
        </div>

        {/* Client interactif */}
        <PredictionCompareClient
          sessions={sessionInfos}
          members={memberData}
          officialResults={officialResults}
          currentUserId={userId}
        />

      </div>
    </main>
  )
}
