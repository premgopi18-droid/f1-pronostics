import { createClient } from '@/lib/supabase'
import { consumePendingInvite } from '@/lib/data/invites'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Parcours invité : pour un compte DÉJÀ finalisé, on auto-join ici. Un nouveau
      // compte (onboarding requis) garde le cookie — completeOnboarding le consommera.
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .maybeSingle()
        if (profile?.onboarding_completed) {
          const leagueId = await consumePendingInvite(user.id)
          if (leagueId) return NextResponse.redirect(new URL(`/leagues/${leagueId}`, origin))
        }
      }
      return NextResponse.redirect(new URL('/', origin))
    }
  }

  return NextResponse.redirect(new URL('/login?error=1', origin))
}
