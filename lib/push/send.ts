import 'server-only'
import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase'

interface PushPayload {
  title: string
  body:  string
  url:   string
}

// Init paresseuse des clés VAPID : `setVapidDetails` lève si une clé manque, donc
// on ne l'appelle jamais à l'import (sinon les route handlers qui importent ce
// module crashent quand VAPID n'est pas configuré). Renvoie false si non configuré.
let vapidConfigured = false

function configureVapid(): boolean {
  if (vapidConfigured) return true
  const { VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env
  if (!VAPID_SUBJECT || !NEXT_PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false
  webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  vapidConfigured = true
  return true
}

async function deliverToSubs(
  subs: { endpoint: string; p256dh: string; auth_key: string }[],
  payload: PushPayload,
): Promise<void> {
  if (subs.length === 0) return
  const supabase = createServiceClient()
  const body = JSON.stringify(payload)

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          body,
        )
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
      }
    }),
  )
}

export async function sendPushToAll(payload: PushPayload): Promise<void> {
  if (!configureVapid()) return
  const supabase = createServiceClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key')
  await deliverToSubs(
    (subs ?? []).map((s) => ({ endpoint: s.endpoint as string, p256dh: s.p256dh as string, auth_key: s.auth_key as string })),
    payload,
  )
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!configureVapid()) return
  const supabase = createServiceClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key')
    .eq('user_id', userId)
  await deliverToSubs(
    (subs ?? []).map((s) => ({ endpoint: s.endpoint as string, p256dh: s.p256dh as string, auth_key: s.auth_key as string })),
    payload,
  )
}
