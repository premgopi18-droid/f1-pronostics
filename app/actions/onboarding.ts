'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { validatePseudo, type PseudoError } from '@/lib/profile/pseudo'
import { HELMET_IDS } from '@/lib/profile/avatars'
import { consumePendingInvite } from '@/lib/data/invites'

/** Codes d'erreur communs (traduits côté UI). */
export type OnboardingError = PseudoError | 'taken' | 'avatar' | 'generic'

export type PseudoCheck = { ok: boolean; error?: PseudoError | 'taken' | 'generic' }

/**
 * Vérifie la validité + la disponibilité d'un pseudo (appelée en direct, débouncée
 * côté client). N'écrit rien.
 */
export async function checkPseudoAvailability(rawPseudo: string): Promise<PseudoCheck> {
  const pseudo = rawPseudo.trim()

  const formatError = validatePseudo(pseudo)
  if (formatError) return { ok: false, error: formatError }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'generic' } // garde-fou : non authentifié

  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('pseudo', pseudo)
    .maybeSingle()

  // Pris si une autre ligne porte ce pseudo (un user peut "reprendre" le sien).
  if (data && data.id !== user.id) return { ok: false, error: 'taken' }
  return { ok: true }
}

export type CompleteOnboardingState = { error?: OnboardingError }

/**
 * Finalise l'onboarding : enregistre pseudo + casque et marque le compte finalisé,
 * puis redirige. La contrainte UNIQUE en base tranche les races sur le pseudo.
 */
export async function completeOnboarding(
  _prev: CompleteOnboardingState,
  formData: FormData,
): Promise<CompleteOnboardingState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const pseudo = ((formData.get('pseudo') as string | null) ?? '').trim()
  const avatarKey = (formData.get('avatar_key') as string | null) ?? ''
  const rawAvatarUrl = (formData.get('avatar_url') as string | null) || null

  const formatError = validatePseudo(pseudo)
  if (formatError) return { error: formatError }
  if (!HELMET_IDS.includes(avatarKey)) return { error: 'avatar' }

  // Photo optionnelle : on n'accepte qu'une URL du bucket public `avatars`.
  const publicPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/`
  const avatarUrl = rawAvatarUrl && rawAvatarUrl.startsWith(publicPrefix) ? rawAvatarUrl : null

  const { error } = await supabase
    .from('profiles')
    .update({
      pseudo,
      avatar_key: avatarKey,
      avatar_url: avatarUrl,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    if (error.code === '23505') return { error: 'taken' }
    return { error: 'generic' }
  }

  // Parcours invité : si un code d'invitation est en attente, auto-join et atterrissage
  // sur la ligue ; sinon Home.
  const leagueId = await consumePendingInvite(user.id)
  redirect(leagueId ? `/leagues/${leagueId}` : '/')
}
