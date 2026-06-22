import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase'
import { consumePendingInvite } from '@/lib/data/invites'
import { PENDING_INVITE_COOKIE } from '@/lib/invites'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Parcours invité : auto-join uniquement si un cookie d'invite est présent —
      // sinon on ne touche pas à `profiles` (chemin de login nominal inchangé). Pour
      // un compte DÉJÀ finalisé on rejoint ici ; un nouveau compte (onboarding requis)
      // garde le cookie, completeOnboarding le consommera. `data.user` est réutilisé
      // (déjà renvoyé par exchangeCodeForSession — pas de getUser() supplémentaire).
      const store = await cookies()
      if (store.get(PENDING_INVITE_COOKIE) && data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', data.user.id)
          .maybeSingle()
        if (profile?.onboarding_completed) {
          const leagueId = await consumePendingInvite(data.user.id)
          if (leagueId) return NextResponse.redirect(new URL(`/leagues/${leagueId}`, origin))
        }
      }
      return NextResponse.redirect(new URL('/', origin))
    }
  }

  return NextResponse.redirect(new URL('/login?error=1', origin))
}
