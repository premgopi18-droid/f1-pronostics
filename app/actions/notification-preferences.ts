'use server'

import { createClient } from '@/lib/supabase'

export type ImminenceScope = 'all' | 'stakes-only' | 'none'

export async function updateImminenceScope(scope: ImminenceScope): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }

  const { error } = await supabase
    .from('profiles')
    .update({ notif_imminence_scope: scope, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { error: 'generic' }
  return {}
}
