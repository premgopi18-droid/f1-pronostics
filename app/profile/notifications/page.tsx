'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Clock, BarChart2, Gift, Flag } from 'lucide-react'
import { subscribeAction, unsubscribeAction } from '@/app/actions/push'
import { t } from '@/lib/i18n'

type PushStatus = 'loading' | 'idle' | 'subscribed' | 'denied' | 'unsupported'

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64     = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(b64)
  const buf     = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i)
  return buf.buffer as ArrayBuffer
}

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
  const [status, setStatus]   = useState<PushStatus>('loading')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setStatus('denied')
      return
    }
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setStatus(sub ? 'subscribed' : 'idle')
    })
  }, [])

  async function handleToggle(targetEnabled: boolean) {
    setPending(true)
    try {
      if (targetEnabled) {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        })
        const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
        await subscribeAction({ endpoint: json.endpoint, keys: json.keys })
        setStatus('subscribed')
      } else {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await sub.unsubscribe()
          await unsubscribeAction(sub.endpoint)
        }
        setStatus('idle')
      }
    } catch {
      setStatus(Notification.permission === 'denied' ? 'denied' : status)
    } finally {
      setPending(false)
    }
  }

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
                  onClick={() => handleToggle(!isSubscribed)}
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
