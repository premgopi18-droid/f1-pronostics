import { cache } from 'react'
import { getCurrentSeason } from '@/lib/api/cron'
import { getSeasonCalendar } from '@/lib/data/results'
import { getCachedDriverStandings, getCachedConstructorStandings } from '@/lib/data/season'
import { t } from '@/lib/i18n'
import { formatParis, formatParisWeekdayTime } from '@/lib/dates'
import { ResultsTabs, type CalendarGpView } from './results-tabs'

// Horodate stable dans le contexte de la requête : évite d'appeler Date.now()
// directement dans le corps du composant (règle react-hooks/purity).
const getTimestamp = cache(Date.now)

function formatDate(iso: string): string {
  return formatParis(iso, { day: 'numeric', month: 'long' })
}

export default async function ResultsPage() {
  const season = getCurrentSeason()
  const [calendar, driverStandings, constructorStandings] = await Promise.all([
    getSeasonCalendar(season),
    getCachedDriverStandings(season),
    getCachedConstructorStandings(season),
  ])
  const nowMs = getTimestamp()

  const gps: CalendarGpView[] = calendar.map((gp) => ({
    id: gp.id,
    countryCode: gp.countryCode,
    displayName: gp.displayName,
    gpName: gp.gpName,
    status: gp.status,
    winner: gp.winner,
    // Pronostiquable tant que la course n'est pas commencée (les sessions déjà
    // passées sont verrouillées individuellement côté page pronostic).
    canPredict: gp.raceStartsAt ? new Date(gp.raceStartsAt).getTime() > nowMs : false,
    hasResults: gp.hasResults,
    formattedQualiTime: gp.qualifyingStartsAt ? formatParisWeekdayTime(gp.qualifyingStartsAt) : null,
    formattedRaceTime:  gp.raceStartsAt       ? formatParisWeekdayTime(gp.raceStartsAt)       : null,
    formattedDate:      gp.raceStartsAt        ? formatDate(gp.raceStartsAt)              : null,
  }))

  return (
    <main className="flex flex-1 flex-col pb-6 pt-6">
      <h1 className="px-page pb-4 font-display text-2xl font-bold text-foreground">
        {t('results.seasonTitle')} {season}
      </h1>
      <ResultsTabs
        gps={gps}
        driverStandings={driverStandings}
        constructorStandings={constructorStandings}
      />
    </main>
  )
}
