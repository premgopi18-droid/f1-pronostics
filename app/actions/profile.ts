'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { HELMET_IDS, DEFAULT_HELMET } from '@/lib/profile/avatars'
import type { TranslationKey } from '@/lib/i18n'

// `error` est une clé i18n (résolue côté form via `t()`), pas un texte en dur.
export type ProfileActionState = { error?: TranslationKey; success?: boolean }

export async function updateProfile(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'profile.errorAuth' }

  const pseudo       = ((formData.get('pseudo') as string | null) ?? '').trim()
  const rawAvatarKey = (formData.get('avatar_key') as string | null) || null

  if (pseudo.length < 2 || pseudo.length > 30) {
    return { error: 'profile.errorLength' }
  }

  // `null` = aucun avatar choisi (conservé). Une clé inconnue (ancien emoji, valeur
  // inattendue) retombe sur le casque par défaut plutôt que de bloquer la sauvegarde.
  const avatarKey =
    rawAvatarKey === null || HELMET_IDS.includes(rawAvatarKey)
      ? rawAvatarKey
      : DEFAULT_HELMET.id

  const { error } = await supabase
    .from('profiles')
    .update({ pseudo, avatar_key: avatarKey, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    if (error.code === '23505') return { error: 'profile.errorTaken' }
    return { error: 'profile.errorGeneric' }
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
  if (!user) return { error: 'profile.errorAuth' }

  // Tout (transfert d'admin toutes saisons, retrait des ligues, anonymisation du
  // profil, effacement des données d'auth) est encapsulé dans le RPC transactionnel
  // `delete_own_account` (SECURITY DEFINER, scopé sur auth.uid()). Cf. migration
  // 20260620140000_delete_account_admin_transfer_all_seasons.sql.
  const { error } = await supabase.rpc('delete_own_account')
  if (error) {
    console.error('deleteAccount: échec', error)
    return { error: 'profile.deleteError' }
  }

  await supabase.auth.signOut()
  redirect('/login')
}
