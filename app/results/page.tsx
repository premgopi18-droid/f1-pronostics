import { getCurrentSeason } from '@/lib/api/cron'
import { getSeasonCalendar } from '@/lib/data/results'
import { t } from '@/lib/i18n'
import { ResultsTabs, type CalendarGpView } from './results-tabs'

const PARIS_TZ = 'Europe/Paris'

function formatSessionTime(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PARIS_TZ,
  }).format(new Date(iso))
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    timeZone: PARIS_TZ,
  }).format(new Date(iso))
}

export default async function ResultsPage() {
  const season = getCurrentSeason()
  const calendar = await getSeasonCalendar(season)
  const nowMs = Date.now()

  const gps: CalendarGpView[] = calendar.map((gp) => ({
    id: gp.id,
    countryCode: gp.countryCode,
    displayName: gp.displayName,
    gpName: gp.gpName,
    status: gp.status,
    winner: gp.winner,
    // Pronostiquable tant que les qualifications ne sont pas commencées.
    canPredict: gp.qualifyingStartsAt ? new Date(gp.qualifyingStartsAt).getTime() > nowMs : false,
    formattedQualiTime: gp.qualifyingStartsAt ? formatSessionTime(gp.qualifyingStartsAt) : null,
    formattedRaceTime:  gp.raceStartsAt       ? formatSessionTime(gp.raceStartsAt)       : null,
    formattedDate:      gp.raceStartsAt        ? formatDate(gp.raceStartsAt)              : null,
  }))

  return (
    <main className="flex flex-1 flex-col pb-6 pt-6">
      <h1 className="px-page pb-4 font-display text-2xl font-bold text-foreground">
        {t('results.seasonTitle')} {season}
      </h1>
      <ResultsTabs gps={gps} />
    </main>
  )
}
