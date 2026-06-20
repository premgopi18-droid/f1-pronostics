'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { AVATAR_OPTIONS } from '@/lib/profile/avatars'

export type ProfileActionState = { error?: string; success?: boolean }

export async function updateProfile(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const pseudo    = ((formData.get('pseudo') as string | null) ?? '').trim()
  const avatarKey = (formData.get('avatar_key') as string | null) || null

  if (pseudo.length < 2 || pseudo.length > 30) {
    return { error: 'Le pseudo doit faire entre 2 et 30 caractères' }
  }
  if (avatarKey !== null && !(AVATAR_OPTIONS as readonly string[]).includes(avatarKey)) {
    return { error: 'Avatar invalide' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ pseudo, avatar_key: avatarKey, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    if (error.code === '23505') return { error: 'Ce pseudo est déjà utilisé' }
    return { error: 'Erreur lors de la mise à jour' }
  }

  revalidatePath('/')
  revalidatePath('/profile')
  return { success: true }
}

export async function deleteAccount(
  _prev: ProfileActionState,
  _formData: FormData,
): Promise<ProfileActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Tout (transfert d'admin toutes saisons, retrait des ligues, anonymisation du
  // profil, effacement des données d'auth) est encapsulé dans le RPC transactionnel
  // `delete_own_account` (SECURITY DEFINER, scopé sur auth.uid()). Cf. migration
  // 20260620140000_delete_account_admin_transfer_all_seasons.sql.
  const { error } = await supabase.rpc('delete_own_account')
  if (error) {
    console.error('deleteAccount: échec', error)
    return { error: 'Erreur lors de la suppression du compte' }
  }

  await supabase.auth.signOut()
  redirect('/login')
}
