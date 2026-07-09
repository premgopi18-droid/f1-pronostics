'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { HELMET_IDS, DEFAULT_HELMET } from '@/lib/profile/avatars'
import { validatePseudo } from '@/lib/profile/pseudo'
import { objectPathFromPublicUrl, AVATARS_BUCKET } from '@/lib/profile/avatar-image'
import type { ActionErrorCode } from '@/lib/actions/errors'

// `error` est un code typé (traduit côté form via translateActionError) — convention #181.
export type ProfileActionState = { error?: ActionErrorCode; success?: boolean }

// N'accepte qu'une URL publique du bucket `avatars` de CE projet, sinon null.
function sanitizeAvatarUrl(url: string | null): string | null {
  if (!url) return null
  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/`
  return url.startsWith(prefix) ? url : null
}

export async function updateProfile(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'notAuthenticated' }

  const pseudo       = ((formData.get('pseudo') as string | null) ?? '').trim()
  const rawAvatarKey = (formData.get('avatar_key') as string | null) || null
  const rawAvatarUrl = (formData.get('avatar_url') as string | null) || null

  // Source de vérité unique des règles pseudo (spec §7), partagée avec l'onboarding.
  const formatError = validatePseudo(pseudo)
  if (formatError) {
    return { error: formatError === 'chars' ? 'pseudoChars' : 'pseudoLength' }
  }

  // `null` = aucun avatar choisi (conservé). Une clé inconnue (ancien emoji, valeur
  // inattendue) retombe sur le casque par défaut plutôt que de bloquer la sauvegarde.
  const avatarKey =
    rawAvatarKey === null || HELMET_IDS.includes(rawAvatarKey)
      ? rawAvatarKey
      : DEFAULT_HELMET.id

  // L'action est un endpoint public : on n'accepte que les URLs du bucket public
  // `avatars` (l'upload lui-même est déjà protégé par RLS au dossier du user).
  // Toute autre valeur → null plutôt que bloquer la sauvegarde.
  const avatarUrl = sanitizeAvatarUrl(rawAvatarUrl)

  // Ancienne photo persistée, pour nettoyer le fichier Storage si elle change.
  const { data: current } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .single()

  const { error } = await supabase
    .from('profiles')
    .update({ pseudo, avatar_key: avatarKey, avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    if (error.code === '23505') return { error: 'pseudoTaken' }
    return { error: 'updateFailed' }
  }

  // La DB pointe désormais vers la nouvelle valeur : on peut supprimer l'ancien
  // fichier s'il a changé (remplacement ou retrait). Best-effort, non bloquant ;
  // RLS n'autorise que la suppression dans le dossier du user.
  const previousUrl = (current?.avatar_url as string | null) ?? null
  if (previousUrl && previousUrl !== avatarUrl) {
    const previousPath = objectPathFromPublicUrl(previousUrl)
    if (previousPath) {
      try {
        await supabase.storage.from(AVATARS_BUCKET).remove([previousPath])
      } catch {
        // best-effort : la DB pointe déjà vers la nouvelle valeur ; un orphelin
        // Storage est négligeable et ne doit pas faire échouer la sauvegarde.
      }
    }
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
  if (!user) return { error: 'notAuthenticated' }

  // Nettoyage des photos d'avatar AVANT le RPC (après, l'utilisateur est déconnecté
  // et anonymisé). On passe par la Storage API pour libérer réellement les octets —
  // le RPC ne supprime que les lignes de métadonnées `storage.objects`. Best-effort.
  try {
    const { data: files } = await supabase.storage.from(AVATARS_BUCKET).list(user.id)
    if (files?.length) {
      await supabase.storage
        .from(AVATARS_BUCKET)
        .remove(files.map((file) => `${user.id}/${file.name}`))
    }
  } catch {
    // best-effort : ne doit pas bloquer la suppression du compte
  }

  // Tout (transfert d'admin toutes saisons, retrait des ligues, anonymisation du
  // profil, effacement des données d'auth) est encapsulé dans le RPC transactionnel
  // `delete_own_account` (SECURITY DEFINER, scopé sur auth.uid()). Cf. migration
  // 20260620140000_delete_account_admin_transfer_all_seasons.sql.
  const { error } = await supabase.rpc('delete_own_account')
  if (error) {
    console.error('deleteAccount: échec', error)
    return { error: 'deleteAccountFailed' }
  }

  await supabase.auth.signOut()
  redirect('/login')
}
