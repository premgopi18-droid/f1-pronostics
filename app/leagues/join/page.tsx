import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { JoinLeagueForm } from './join-form'
import { JoinPreview } from './join-preview'
import { getLeagueByCode } from '@/lib/data/leagues'
import { getCurrentSeason } from '@/lib/api/cron'
import { t } from '@/lib/i18n'

export default async function JoinLeaguePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const { code } = await searchParams
  const inviteCode = code?.trim().toUpperCase()
  const preview = inviteCode
    ? await getLeagueByCode(inviteCode, getCurrentSeason())
    : null

  return (
    <main className="flex min-h-dvh flex-col px-page pb-6 pt-8">
      <Link
        href="/"
        aria-label={t('common.back')}
        className="mb-6 inline-flex w-fit items-center gap-1 rounded-md text-sm text-text-secondary transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeft size={18} aria-hidden />
        {t('common.back')}
      </Link>

      {preview && inviteCode ? (
        <JoinPreview preview={preview} code={inviteCode} />
      ) : (
        <>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {t('join.manualTitle')}
          </h1>
          <div className="mt-6">
            <JoinLeagueForm initialCode={code} />
          </div>
        </>
      )}
    </main>
  )
}
