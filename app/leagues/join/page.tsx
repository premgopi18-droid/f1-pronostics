import Link from 'next/link'
import { JoinLeagueForm } from './join-form'

export default async function JoinLeaguePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const { code } = await searchParams

  return (
    <main className="min-h-screen bg-zinc-950 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
            ← Retour
          </Link>
          <h1 className="text-2xl font-bold text-white">Rejoindre une ligue</h1>
        </div>

        <JoinLeagueForm initialCode={code} />
      </div>
    </main>
  )
}
