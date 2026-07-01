'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ChevronLeft, Clock, BarChart2, Gift, Flag, Bell, Megaphone } from 'lucide-react'
import { usePushSubscription } from '@/lib/push/client'
import { t } from '@/lib/i18n'
import {
  updateImminenceScope,
  updateAnnouncementsOptIn,
  type ImminenceScope,
} from '@/app/actions/notification-preferences'

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

const IMMINENCE_SCOPE_OPTIONS: { value: ImminenceScope; labelKey: 'notifications.imminenceScopeAll' | 'notifications.imminenceScopeStakes' | 'notifications.imminenceScopeNone' }[] = [
  { value: 'all',         labelKey: 'notifications.imminenceScopeAll' },
  { value: 'stakes-only', labelKey: 'notifications.imminenceScopeStakes' },
  { value: 'none',        labelKey: 'notifications.imminenceScopeNone' },
]

export function NotificationsContent({
  defaultImminenceScope,
  defaultAnnouncementsOptIn,
}: {
  defaultImminenceScope: ImminenceScope
  defaultAnnouncementsOptIn: boolean
}) {
  const { status, pending, toggle } = usePushSubscription()
  const [imminenceScope, setImminenceScope] = useState<ImminenceScope>(defaultImminenceScope)
  const [announcementsOptIn, setAnnouncementsOptIn] = useState(defaultAnnouncementsOptIn)
  const [saveError, setSaveError] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isSubscribed = status === 'subscribed'

  function handleScopeChange(scope: ImminenceScope) {
    if (scope === imminenceScope) return
    // Optimiste : on applique tout de suite, et on revient à la valeur précédente
    // si l'écriture échoue (session expirée, erreur réseau) pour ne pas afficher
    // une préférence non persistée.
    const previous = imminenceScope
    setSaveError(false)
    setImminenceScope(scope)
    startTransition(async () => {
      const result = await updateImminenceScope(scope)
      if (result.error) {
        setImminenceScope(previous)
        setSaveError(true)
      }
    })
  }

  function handleAnnouncementsToggle() {
    // Même stratégie optimiste que le périmètre imminence : bascule immédiate, rollback si échec.
    const previous = announcementsOptIn
    setSaveError(false)
    setAnnouncementsOptIn(!previous)
    startTransition(async () => {
      const result = await updateAnnouncementsOptIn(!previous)
      if (result.error) {
        setAnnouncementsOptIn(previous)
        setSaveError(true)
      }
    })
  }

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

          {/* Session imminente — préférence de périmètre */}
          <div className="mt-6 overflow-hidden rounded-2xl bg-card">
            <div className="flex items-center gap-3 px-4 py-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Bell size={18} className="text-muted-foreground" aria-hidden />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{t('notifications.imminence')}</span>
                <span className="text-xs text-muted-foreground">{t('notifications.imminenceSub')}</span>
              </span>
            </div>
            <div
              role="radiogroup"
              aria-label={t('notifications.imminence')}
              className="flex divide-x divide-border border-t border-border"
            >
              {IMMINENCE_SCOPE_OPTIONS.map(({ value, labelKey }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  disabled={isPending}
                  onClick={() => handleScopeChange(value)}
                  aria-checked={imminenceScope === value}
                  className={[
                    'flex flex-1 items-center justify-center px-2 py-3 text-xs font-medium transition-colors disabled:opacity-60',
                    imminenceScope === value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted/50 active:bg-muted',
                  ].join(' ')}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Annonces produit (« Nouveautés ») — opt-in dédié, indépendant du reste */}
          <div className="mt-6 overflow-hidden rounded-2xl bg-card">
            <button
              type="button"
              onClick={handleAnnouncementsToggle}
              disabled={isPending}
              aria-pressed={announcementsOptIn}
              className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/50 active:bg-muted disabled:opacity-60"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Megaphone size={18} className="text-muted-foreground" aria-hidden />
              </span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{t('notifications.announcements')}</span>
                <span className="text-xs text-muted-foreground">{t('notifications.announcementsSub')}</span>
              </span>
              {/* Toggle pill */}
              <span
                className={[
                  'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
                  announcementsOptIn ? 'bg-primary' : 'bg-muted',
                ].join(' ')}
                aria-hidden
              >
                <span
                  className={[
                    'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200',
                    announcementsOptIn ? 'translate-x-5' : 'translate-x-0',
                  ].join(' ')}
                />
              </span>
            </button>
          </div>

          {isPending && (
            <p className="mt-2 text-xs text-muted-foreground" role="status">
              {t('notifications.imminenceScopeSaving')}
            </p>
          )}
          {saveError && (
            <p className="mt-2 text-xs text-destructive" role="alert">
              {t('notifications.imminenceScopeError')}
            </p>
          )}
        </>
      )}
    </main>
  )
}
