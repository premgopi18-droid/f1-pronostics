import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'
import { POSITIONS_TO_SCORE } from '@/lib/scoring/constants'
import { PredictionForm } from './prediction-form'
import type { SessionType } from '@/lib/scoring/types'

export default async function PredictionsPage({
  params,
}: {
  params: Promise<{ gpId: string }>
}) {
  const { gpId } = await params
  const supabase  = await createClient()
  const season    = getCurrentSeason()

  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: gp }, { data: sessions }, { data: drivers }] = await Promise.all([
    supabase
      .from('grands_prix')
      .select('id, name, country, round')
      .eq('id', gpId)
      .single(),
    supabase
      .from('sessions')
      .select('id, type, starts_at')
      .eq('gp_id', gpId)
      .eq('season', season)
      .order('starts_at'),
    supabase
      .from('drivers')
      .select('id, code, first_name, last_name, number')
      .eq('season', season)
      .order('code'),
  ])

  if (!gp) notFound()

  const sessionIds = (sessions ?? []).map((s) => s.id as string)

  let predictionsBySession  = new Map<string, string[]>()
  let fastestLapBySession   = new Map<string, string | null>()

  if (sessionIds.length > 0) {
    const [{ data: predictions }, { data: fastestLapRows }] = await Promise.all([
      supabase
        .from('predictions')
        .select('session_id, entries')
        .eq('user_id', user!.id)
        .in('session_id', sessionIds),
      supabase
        .from('fastest_lap_predictions')
        .select('session_id, drivers!driver_id(code)')
        .eq('user_id', user!.id)
        .in('session_id', sessionIds),
    ])

    predictionsBySession = new Map(
      (predictions ?? []).map((p) => [p.session_id as string, p.entries as string[]]),
    )
    fastestLapBySession = new Map(
      (fastestLapRows ?? []).map((p) => {
        const driver = (p.drivers as unknown) as { code: string } | null
        return [p.session_id as string, driver?.code ?? null]
      }),
    )
  }

  const now = new Date()

  const mappedDrivers = (drivers ?? []).map((d) => ({
    id:        d.id as string,
    code:      d.code as string,
    firstName: d.first_name as string,
    lastName:  d.last_name as string,
    number:    d.number as number,
  }))

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="max-w-sm mx-auto flex flex-col gap-8">

        {/* Header */}
        <div className="flex flex-col gap-1">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors mb-1">
            ← Accueil
          </Link>
          <h1 className="text-2xl font-bold text-white">{gp.name as string}</h1>
          <p className="text-zinc-400 text-sm">
            {gp.country as string} · Round {gp.round as number} · {season}
          </p>
        </div>

        {sessions?.length === 0 && (
          <p className="text-zinc-500 text-sm">Les sessions ne sont pas encore disponibles.</p>
        )}

        {/* Formulaire par session */}
        {(sessions ?? []).map((session) => (
          <div key={session.id as string} className="bg-zinc-900 rounded-xl p-4">
            <PredictionForm
              sessionId={session.id as string}
              sessionType={session.type as SessionType}
              season={season}
              drivers={mappedDrivers}
              expectedCount={POSITIONS_TO_SCORE[session.type as SessionType]}
              existingEntries={predictionsBySession.get(session.id as string) ?? []}
              existingFastestLap={fastestLapBySession.get(session.id as string) ?? null}
              isLocked={new Date(session.starts_at as string) <= now}
            />
          </div>
        ))}

      </div>
    </main>
  )
}
