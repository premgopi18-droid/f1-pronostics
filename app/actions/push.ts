'use server'

import { createClient } from '@/lib/supabase'

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
