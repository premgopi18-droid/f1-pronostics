import { redirect } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { getCurrentSeason } from '@/lib/api/cron'
import { getCachedDrivers, getCachedConstructors } from '@/lib/f1/cached'
import {
  getSeasonPrediction,
  getSeasonDeadlines,
  getSeasonItems,
} from '@/lib/data/season-predictions'
import { getCachedDriverStandings, getCachedConstructorStandings } from '@/lib/data/season'
import { t } from '@/lib/i18n'
import { SeasonFormLoader } from './season-form-loader'
import { SeasonComparison } from './season-comparison'

const PARIS_TZ = 'Europe/Paris'

function formatDeadline(d: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: PARIS_TZ,
  }).format(d)
}

export default async function SeasonPage() {
  const season = getCurrentSeason()
  const userId   = (await headers()).get('x-user-id')

  if (!userId) redirect('/login')

  const [
    driversRaw,
    constructorsRaw,
    wdcEntries,
    wccEntries,
    deadlines,
    seasonItems,
    driverStandings,
    constructorStandings,
  ] = await Promise.all([
    getCachedDrivers(season),
    getCachedConstructors(season),
    getSeasonPrediction(userId, season, 'wdc'),
    getSeasonPrediction(userId, season, 'wcc'),
    getSeasonDeadlines(season, userId),
    getSeasonItems(userId, season),
    getCachedDriverStandings(season),
    getCachedConstructorStandings(season),
  ])

  const now = new Date()
  const isSubmissionOpen = !deadlines.submissionDeadline || now < deadlines.submissionDeadline
  const isItemsOpen      = !deadlines.itemDeadline       || now < deadlines.itemDeadline

  const driverList = driversRaw.map((d) => ({
    code:      d.code,
    firstName: d.first_name,
    lastName:  d.last_name,
  }))
  const constructorList = constructorsRaw.map((c) => ({
    code: c.code,
    name: c.name,
  }))

  return (
    <main className="flex flex-1 flex-col pb-6 pt-6">
      {/* Header */}
      <div className="px-page mb-5 flex flex-col gap-1">
        <Link
          href="/"
          className="text-sm font-semibold text-text-secondary hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          ← {t('season.back')}
        </Link>
        <h1 className="font-display text-2xl font-bold text-foreground">
          {t('season.pageTitle')}
        </h1>
        {deadlines.submissionDeadline && (
          <p className={`text-sm ${isSubmissionOpen ? 'text-text-secondary' : 'text-primary-text font-semibold'}`}>
            {isSubmissionOpen
              ? `${t('season.deadlinePrefix')} ${formatDeadline(deadlines.submissionDeadline)}`
              : t('season.lockedSince')
            }
          </p>
        )}
      </div>

      {isSubmissionOpen ? (
        // ── Prédictions ouvertes : formulaire drag-to-rank ──────────────────
        <div className="px-page">
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
      ) : (
        // ── Prédictions verrouillées : vue comparaison ───────────────────────
        <SeasonComparison
          userWdc={wdcEntries}
          userWcc={wccEntries}
          driverStandings={driverStandings}
          constructorStandings={constructorStandings}
          seasonItems={seasonItems}
          isItemsOpen={isItemsOpen}
        />
      )}
    </main>
  )
}
