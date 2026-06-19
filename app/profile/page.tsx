import { notFound } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase'
import { ProfileForm } from './profile-form'

export default async function ProfilePage() {
  const supabase = await createClient()
  const userId   = (await headers()).get('x-user-id')!

  // getSession() lit depuis le cookie (0 appel réseau) — suffit pour l'email affiché
  const [{ data: profile }, { data: { session } }] = await Promise.all([
    supabase.from('profiles').select('pseudo, avatar_key').eq('id', userId).single(),
    supabase.auth.getSession(),
  ])

  if (!profile) notFound()

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="max-w-sm mx-auto flex flex-col gap-8">

        <div className="flex flex-col gap-1">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
            ← Accueil
          </Link>
          <h1 className="text-2xl font-bold text-white">Mon profil</h1>
        </div>

        <ProfileForm
          pseudo={profile.pseudo as string}
          avatarKey={profile.avatar_key as string | null}
          email={session?.user?.email ?? ''}
        />

      </div>
    </main>
  )
}
