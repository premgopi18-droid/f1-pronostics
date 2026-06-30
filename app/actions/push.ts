'use server'

import { createClient } from '@/lib/supabase'
import { getImminentDeadlineForCatchUp } from '@/lib/data/f1-sync'
import { isPushConfigured, sendPushToUser } from '@/lib/push/send'
import { getCurrentSeason } from '@/lib/api/cron'

export async function subscribeAction(subscription: {
  endpoint: string
  keys: { p256dh: string; auth: string }
}): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id:  user.id,
      endpoint: subscription.endpoint,
      p256dh:   subscription.keys.p256dh,
      auth_key: subscription.keys.auth,
    },
    { onConflict: 'endpoint' },
  )
  // Propager l'échec : sinon le composant passe en 'subscribed' alors qu'aucune
  // ligne n'a été écrite (ex. RLS bloque, endpoint détenu par un autre user).
  if (error) throw error

  // Notif de rattrapage (#115) : si l'utilisateur active les push alors qu'une
  // deadline (pronos + items) tombe dans la fenêtre courte, le cron de rappel
  // (J-1, 1h avant) est déjà passé → on le prévient immédiatement. Best-effort :
  // ne doit jamais faire échouer l'abonnement (sinon le toggle resterait off).
  try {
    if (isPushConfigured()) {
      const deadline = await getImminentDeadlineForCatchUp(getCurrentSeason())
      if (deadline) {
        await sendPushToUser(user.id, {
          title: `⏰ ${deadline.gpName} — dernière ligne droite`,
          body:  'La deadline approche : dépose tes pronostics et joue tes items avant le verrouillage !',
          url:   `/predictions/${deadline.gpId}`,
        })
      }
    }
  } catch (catchUpError) {
    console.error('[subscribeAction] notif de rattrapage', catchUpError)
  }
}

export async function unsubscribeAction(endpoint: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('user_id', user.id)
  if (error) throw error
}
