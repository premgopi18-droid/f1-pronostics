import Link from 'next/link'
import { iconButtonVariants } from '@/app/ui/icon-button'
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
          className={iconButtonVariants()}
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
