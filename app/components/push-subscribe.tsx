'use client'

import { useState, useEffect } from 'react'
import { subscribeAction, unsubscribeAction } from '@/app/actions/push'

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const buf = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i)
  return buf.buffer as ArrayBuffer
}

type Status = 'loading' | 'idle' | 'subscribed' | 'denied' | 'unsupported'

export function PushSubscribe() {
  const [status, setStatus]   = useState<Status>('loading')
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

  const subscribe = async () => {
    setPending(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      await subscribeAction({ endpoint: json.endpoint, keys: json.keys })
      setStatus('subscribed')
    } catch {
      setStatus(Notification.permission === 'denied' ? 'denied' : 'idle')
    } finally {
      setPending(false)
    }
  }

  const unsubscribe = async () => {
    setPending(true)
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await sub.unsubscribe()
      await unsubscribeAction(sub.endpoint)
    }
    setStatus('idle')
    setPending(false)
  }

  if (status === 'loading' || status === 'unsupported' || status === 'denied') return null

  return (
    <button
      onClick={status === 'subscribed' ? unsubscribe : subscribe}
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
