import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'
import { signOut } from '@/app/actions/auth'

export default async function HomePage() {
  const supabase = await createClient()
  const season   = getCurrentSeason()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('pseudo')
    .eq('id', user!.id)
    .single()

  const { data: memberships } = await supabase
    .from('league_members')
    .select('league_id, leagues!league_id ( name )')
    .eq('user_id', user!.id)
    .eq('season', season)

  const leagues = (memberships ?? []).map((m) => {
    const league = (m.leagues as unknown) as { name: string } | null
    return { id: m.league_id as string, name: league?.name ?? 'Ligue sans nom' }
  })

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="max-w-sm mx-auto flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">BoxBox</h1>
          <form action={signOut}>
            <button type="submit" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors cursor-pointer">
              Déconnexion
            </button>
          </form>
        </div>

        <p className="text-zinc-400 text-sm">
          Bonjour, <span className="text-white font-medium">{profile?.pseudo}</span>
        </p>

        {/* Ligues */}
        {leagues.length > 0 ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Mes ligues</h2>
            <div className="flex flex-col gap-2">
              {leagues.map((league) => (
                <Link
                  key={league.id}
                  href={`/leagues/${league.id}`}
                  className="flex items-center justify-between bg-zinc-900 hover:bg-zinc-800 rounded-xl px-4 py-3 transition-colors"
                >
                  <span className="text-white font-medium">{league.name}</span>
                  <span className="text-zinc-500 text-sm">→</span>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-xl p-6 flex flex-col gap-2 text-center">
            <p className="text-white font-medium">Pas encore de ligue</p>
            <p className="text-zinc-500 text-sm">Crée ou rejoins une ligue pour commencer</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Link
            href="/leagues/new"
            className="bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg px-4 py-2.5 text-center transition-colors"
          >
            Créer une ligue
          </Link>
          <Link
            href="/leagues/join"
            className="bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg px-4 py-2.5 text-center transition-colors"
          >
            Rejoindre avec un code
          </Link>
        </div>

      </div>
    </main>
  )
}
