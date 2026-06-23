'use client'

import Link from 'next/link'
import { ChevronLeft, Clock, BarChart2, Gift, Flag } from 'lucide-react'
import { usePushSubscription } from '@/lib/push/client'
import { t } from '@/lib/i18n'

const NOTIFICATION_ROWS = [
  {
    icon: Clock,
    labelKey: 'notifications.deadline'    as const,
    subKey:   'notifications.deadlineSub' as const,
  },
  {
    icon: BarChart2,
    labelKey: 'notifications.scores'    as const,
    subKey:   'notifications.scoresSub' as const,
  },
  {
    icon: Gift,
    labelKey: 'notifications.items'    as const,
    subKey:   'notifications.itemsSub' as const,
  },
  {
    icon: Flag,
    labelKey: 'notifications.gpApproach'    as const,
    subKey:   'notifications.gpApproachSub' as const,
  },
] as const

export default function NotificationsPage() {
  const { status, pending, toggle } = usePushSubscription()

  const isSubscribed = status === 'subscribed'

  return (
    <main className="flex flex-1 flex-col px-page pt-2 pb-6">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <Link
          href="/profile"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t('notifications.back')}
        >
          <ChevronLeft size={20} aria-hidden />
        </Link>
        <h1 className="font-display text-xl font-bold text-foreground">
          {t('notifications.title')}
        </h1>
      </div>

      {status === 'unsupported' && (
        <p className="mt-4 text-sm text-muted-foreground">{t('notifications.unsupported')}</p>
      )}

      {status === 'denied' && (
        <p className="mt-4 text-sm text-muted-foreground">{t('notifications.denied')}</p>
      )}

      {(status === 'loading' || status === 'idle' || status === 'subscribed') && (
        <>
          <p className="mb-4 text-sm text-muted-foreground">{t('notifications.subtitle')}</p>

          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl bg-card">
            {NOTIFICATION_ROWS.map(({ icon: Icon, labelKey, subKey }) => (
              <li key={labelKey}>
                <button
                  type="button"
                  disabled={pending || status === 'loading'}
                  onClick={() => toggle(!isSubscribed)}
                  aria-pressed={isSubscribed}
                  className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/50 active:bg-muted disabled:opacity-60"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <Icon size={18} className="text-muted-foreground" aria-hidden />
                  </span>
                  <span className="flex flex-1 flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">{t(labelKey)}</span>
                    <span className="text-xs text-muted-foreground">{t(subKey)}</span>
                  </span>
                  {/* Toggle pill — MVP : état global shared par toutes les catégories */}
                  <span
                    className={[
                      'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
                      isSubscribed ? 'bg-primary' : 'bg-muted',
                    ].join(' ')}
                    aria-hidden
                  >
                    <span
                      className={[
                        'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200',
                        isSubscribed ? 'translate-x-5' : 'translate-x-0',
                      ].join(' ')}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
