'use client'

import { useEffect, useState } from 'react'
import { subscribeAction, unsubscribeAction } from '@/app/actions/push'

export type PushStatus = 'loading' | 'idle' | 'subscribed' | 'denied' | 'unsupported'

/** Convertit la clé VAPID base64url en `ArrayBuffer` attendu par `pushManager.subscribe`. */
export function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64     = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(b64)
  const buf     = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i)
  return buf.buffer as ArrayBuffer
}

/**
 * Gère l'abonnement Web Push global de l'appareil (un seul abonnement par navigateur).
 * Source unique pour toutes les UIs de notifications (nudge home, écran réglages) afin
 * d'éviter de dupliquer la machine d'état et le format de payload côté client.
 */
export function usePushSubscription() {
  const [status, setStatus]   = useState<PushStatus>('loading')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    async function init() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setStatus('unsupported')
        return
      }
      if (Notification.permission === 'denied') {
        setStatus('denied')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setStatus(sub ? 'subscribed' : 'idle')
    }
    void init()
  }, [])

  async function subscribe() {
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

  async function unsubscribe() {
    setPending(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await unsubscribeAction(sub.endpoint)
      }
      setStatus('idle')
    } finally {
      setPending(false)
    }
  }

  /** Bascule vers l'état demandé (`true` = abonner, `false` = désabonner). */
  async function toggle(targetEnabled: boolean) {
    return targetEnabled ? subscribe() : unsubscribe()
  }

  return { status, pending, subscribe, unsubscribe, toggle }
}
