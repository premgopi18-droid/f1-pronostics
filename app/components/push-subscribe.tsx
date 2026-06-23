'use client'

import { usePushSubscription } from '@/lib/push/client'

export function PushSubscribe() {
  const { status, pending, toggle } = usePushSubscription()

  if (status === 'loading' || status === 'unsupported' || status === 'denied') return null

  const isSubscribed = status === 'subscribed'

  return (
    <button
      onClick={() => toggle(!isSubscribed)}
      disabled={pending}
      className="flex items-center gap-2 px-4 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 transition-colors w-full text-left"
    >
      <span className="text-base">{status === 'subscribed' ? '🔔' : '🔕'}</span>
      <span className="text-sm text-white">
        {status === 'subscribed' ? 'Notifications activées' : 'Activer les notifications'}
      </span>
      {status === 'subscribed' && (
        <span className="ml-auto text-xs text-zinc-500">Désactiver</span>
      )}
    </button>
  )
}
