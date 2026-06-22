'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { validatePseudo, type PseudoError } from '@/lib/profile/pseudo'
import { HELMET_IDS } from '@/lib/profile/avatars'

/** Codes d'erreur communs (traduits côté UI). */
export type OnboardingError = PseudoError | 'taken' | 'avatar' | 'generic'

export type PseudoCheck = { ok: boolean; error?: PseudoError | 'taken' }

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
  if (!user) return { ok: false, error: 'taken' } // garde-fou : non authentifié

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

  const formatError = validatePseudo(pseudo)
  if (formatError) return { error: formatError }
  if (!HELMET_IDS.includes(avatarKey)) return { error: 'avatar' }

  const { error } = await supabase
    .from('profiles')
    .update({
      pseudo,
      avatar_key: avatarKey,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    if (error.code === '23505') return { error: 'taken' }
    return { error: 'generic' }
  }

  // Parcours invité (token → auto-join) : branché au ticket #43. Par défaut → Home.
  redirect('/')
}
