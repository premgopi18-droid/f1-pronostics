'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase'
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

  // Anonymisation RGPD de l'email : on conserve la ligne auth.users (sa
  // suppression cascade sur profiles, bloquée ensuite par les FK NO ACTION de
  // scores/league_members qui protègent l'historique), mais on remplace l'email
  // par une valeur neutre via le client service-role. Effet de bord voulu :
  // l'email d'origine est libéré, donc réutilisable pour une future inscription.
  // Étape verrouillante — si elle échoue, on abandonne sans rien anonymiser.
  try {
    const admin = createServiceClient()
    const { error: emailError } = await admin.auth.admin.updateUserById(user.id, {
      email: `deleted+${user.id}@deleted.invalid`,
    })
    if (emailError) {
      console.error('deleteAccount: anonymisation email échouée', emailError)
      return { error: 'Erreur lors de la suppression du compte' }
    }
  } catch (error) {
    console.error('deleteAccount: anonymisation email échouée', error)
    return { error: 'Erreur lors de la suppression du compte' }
  }

  // Transférer l'admin aux ligues où l'utilisateur est admin.
  // La RLS "admins manage members" autorise un admin à modifier is_admin des autres membres.
  const { data: adminMemberships } = await supabase
    .from('league_members')
    .select('league_id')
    .eq('user_id', user.id)
    .eq('season', season)
    .eq('is_admin', true)

  for (const { league_id } of adminMemberships ?? []) {
    const { data: candidates, error: candidatesError } = await supabase
      .from('league_members')
      .select('user_id, profiles!user_id(is_deleted)')
      .eq('league_id', league_id)
      .eq('season', season)
      .neq('user_id', user.id)
      .order('joined_at', { ascending: true })

    if (candidatesError) {
      console.error('deleteAccount: lecture des candidats admin échouée', candidatesError)
      continue
    }

    const next = (candidates ?? []).find(
      (m) => !((m.profiles as unknown as { is_deleted: boolean } | null)?.is_deleted),
    )

    if (next) {
      // Nommer le successeur d'abord, puis se retirer — l'ordre respecte le
      // trigger "au moins 1 admin". Sans successeur actif, on reste admin
      // fantôme (cas rarissime, ligue sans membre actif restant).
      await supabase
        .from('league_members')
        .update({ is_admin: true })
        .eq('league_id', league_id)
        .eq('season', season)
        .eq('user_id', next.user_id)

      await supabase
        .from('league_members')
        .update({ is_admin: false })
        .eq('league_id', league_id)
        .eq('season', season)
        .eq('user_id', user.id)
    }
  }

  // Anonymisation du profil : pseudo neutre (libère la contrainte UNIQUE),
  // avatar retiré, marqueur is_deleted pour l'affichage "Compte supprimé".
  const { error } = await supabase
    .from('profiles')
    .update({
      pseudo:     `Compte supprimé ${user.id.slice(0, 8)}`,
      avatar_key: null,
      is_deleted: true,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return { error: 'Erreur lors de la suppression du compte' }

  await supabase.auth.signOut()
  redirect('/login')
}
