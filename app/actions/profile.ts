'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'
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

  const season = getCurrentSeason()

  // Transférer l'admin aux ligues où l'utilisateur est le seul admin.
  // La RLS "admins manage members" autorise un admin à modifier is_admin des autres membres.
  const { data: adminMemberships } = await supabase
    .from('league_members')
    .select('league_id')
    .eq('user_id', user.id)
    .eq('season', season)
    .eq('is_admin', true)

  for (const { league_id } of adminMemberships ?? []) {
    const { data: candidates } = await supabase
      .from('league_members')
      .select('user_id, profiles!user_id(is_deleted)')
      .eq('league_id', league_id)
      .eq('season', season)
      .neq('user_id', user.id)
      .order('created_at', { ascending: true })

    const next = (candidates ?? []).find(
      (m) => !((m.profiles as unknown as { is_deleted: boolean } | null)?.is_deleted),
    )

    if (next) {
      await supabase
        .from('league_members')
        .update({ is_admin: true })
        .eq('league_id', league_id)
        .eq('season', season)
        .eq('user_id', next.user_id)
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { error: 'Erreur lors de la suppression du compte' }

  await supabase.auth.signOut()
  redirect('/login')
}
