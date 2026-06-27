import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getGpDetail } from '@/lib/data/results'
import { t } from '@/lib/i18n'
import { GpResultsTabs } from './results-tabs'

interface Props {
  params: Promise<{ gpId: string }>
}

export default async function GpResultsPage({ params }: Props) {
  const { gpId } = await params
  const gp = await getGpDetail(gpId)

  if (!gp) notFound()

  return (
    <main className="flex flex-1 flex-col pb-6">
      {/* Header */}
      <div className="flex items-center gap-2 px-page py-4">
        <Link
          href="/results"
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          aria-label={t('results.gpBack')}
        >
          <ChevronLeft size={16} aria-hidden />
          <span className="text-2xs font-bold">{gp.countryCode}</span>
        </Link>
        <span className="text-text-muted" aria-hidden>·</span>
        <h1 className="font-display text-lg font-bold text-foreground leading-tight">
          {gp.gpName}
        </h1>
      </div>

      <div className="px-page">
        <GpResultsTabs
          race={gp.race}
          qualifying={gp.qualifying}
          sprintRace={gp.sprintRace}
          sprintQualifying={gp.sprintQualifying}
          practice1={gp.practice1}
          practice2={gp.practice2}
          practice3={gp.practice3}
        />
      </div>
    </main>
  )
}
