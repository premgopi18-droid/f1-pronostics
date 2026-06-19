'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase'

type AdminResult = { error?: string; success?: boolean }

export async function toggleInvites(
  leagueId:  string,
  inviteOpen: boolean,
): Promise<AdminResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase
    .from('leagues')
    .update({ invite_open: !inviteOpen })
    .eq('id', leagueId)

  if (error) return { error: 'Erreur lors de la mise à jour' }

  revalidatePath(`/leagues/${leagueId}`)
  return { success: true }
}

export async function regenerateInviteCode(
  leagueId: string,
): Promise<AdminResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Même format que create_league : 8 hex majuscules, retry sur collision UNIQUE (rarissime)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()

    const { error } = await supabase
      .from('leagues')
      .update({ invite_code: code })
      .eq('id', leagueId)

    if (!error) {
      revalidatePath(`/leagues/${leagueId}`)
      return { success: true }
    }

    if (error.code !== '23505') return { error: 'Erreur lors de la régénération' }
  }

  return { error: 'Impossible de générer un code unique' }
}
