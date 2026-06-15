import { createClient } from '@/lib/supabase'
import { signOut } from '@/app/actions/auth'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('pseudo')
    .eq('id', user!.id)
    .single()

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-bold text-white tracking-tight">BoxBox</h1>
        <p className="text-zinc-400">
          Connecté en tant que <span className="text-white font-medium">{profile?.pseudo}</span>
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors cursor-pointer"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </main>
  )
}
