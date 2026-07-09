'use server'

import { createClient } from '@/lib/supabase'
import type { ActionErrorCode } from '@/lib/actions/errors'

export type ImminenceScope = 'all' | 'stakes-only' | 'none'

export async function updateImminenceScope(scope: ImminenceScope): Promise<{ error?: ActionErrorCode }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'notAuthenticated' }

  const { error } = await supabase
    .from('profiles')
    .update({ notif_imminence_scope: scope, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { error: 'updateFailed' }
  return {}
}

// Opt-in des annonces produit (« Nouveautés ») — indépendant de `notif_imminence_scope`.
export async function updateAnnouncementsOptIn(enabled: boolean): Promise<{ error?: ActionErrorCode }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'notAuthenticated' }

  const { error } = await supabase
    .from('profiles')
    .update({ notif_announcements: enabled, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { error: 'updateFailed' }
  return {}
}
