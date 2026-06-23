import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { t } from '@/lib/i18n'
import { CreateLeagueForm } from './create-form'

export default function NewLeaguePage() {
  return (
    <main className="flex flex-1 flex-col px-page pt-2 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 py-2">
        <Link
          href="/leagues"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-foreground transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={t('common.back')}
        >
          <ChevronLeft size={20} aria-hidden />
        </Link>
        <h1 className="font-display text-xl font-bold text-foreground">
          {t('createLeague.title')}
        </h1>
      </div>

      <div className="mt-6">
        <CreateLeagueForm />
      </div>
    </main>
  )
}
