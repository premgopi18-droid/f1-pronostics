import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'
import {
  getSeasonPrediction,
  getSeasonDeadlines,
  getSeasonItems,
} from '@/lib/data/season-predictions'
import { SeasonFormLoader } from './season-form-loader'

export default async function SeasonPage() {
  const supabase = await createClient()
  const season   = getCurrentSeason()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = createServiceClient()

  const [
    { data: drivers },
    { data: constructors },
    wdcEntries,
    wccEntries,
    deadlines,
    seasonItems,
  ] = await Promise.all([
    db.from('drivers').select('code, first_name, last_name').eq('season', season).order('last_name'),
    db.from('constructors').select('code, name').eq('season', season).order('name'),
    getSeasonPrediction(user.id, season, 'wdc'),
    getSeasonPrediction(user.id, season, 'wcc'),
    getSeasonDeadlines(season),
    getSeasonItems(user.id, season),
  ])

  const now = new Date()
  const isSubmissionOpen = !deadlines.submissionDeadline || now < deadlines.submissionDeadline
  const isItemsOpen      = !deadlines.itemDeadline       || now < deadlines.itemDeadline

  const driverList = (drivers ?? []).map((d) => ({
    code:      d.code as string,
    firstName: d.first_name as string,
    lastName:  d.last_name as string,
  }))

  const constructorList = (constructors ?? []).map((c) => ({
    code: c.code as string,
    name: c.name as string,
  }))

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="max-w-lg mx-auto flex flex-col gap-8">

        <div className="flex flex-col gap-1">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
            ← Accueil
          </Link>
          <h1 className="text-2xl font-bold text-white">Pronostics saison</h1>
          {deadlines.submissionDeadline && (
            <p className={`text-sm mt-1 ${isSubmissionOpen ? 'text-zinc-400' : 'text-red-400'}`}>
              {isSubmissionOpen
                ? `Deadline : ${deadlines.submissionDeadline.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`
                : 'Pronostics verrouillés depuis le 1er GP'
              }
            </p>
          )}
        </div>

        <SeasonFormLoader
          drivers={driverList}
          constructors={constructorList}
          initialWdc={wdcEntries}
          initialWcc={wccEntries}
          isSubmissionOpen={isSubmissionOpen}
          isItemsOpen={isItemsOpen}
          seasonItems={seasonItems}
        />

      </div>
    </main>
  )
}
