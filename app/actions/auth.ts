'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ONBOARDED_COOKIE } from '@/lib/auth/onboarding-cookie'

export async function signInWithGoogle() {
  const supabase = await createClient()
  const { data } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback`,
    },
  })

  if (data.url) redirect(data.url)
  redirect('/login?error=1')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  // Cookie de gating onboarding (#243) : ne pas laisser l'id du compte 30 jours sur un
  // appareil partagé. Fonctionnellement inutile (valeur = id, un autre compte relit la DB).
  ;(await cookies()).delete(ONBOARDED_COOKIE)
  redirect('/login')
}
