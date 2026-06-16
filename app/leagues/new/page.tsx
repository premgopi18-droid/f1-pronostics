import Link from 'next/link'
import { CreateLeagueForm } from './create-form'

export default function NewLeaguePage() {
  return (
    <main className="min-h-screen bg-zinc-950 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
            ← Retour
          </Link>
          <h1 className="text-2xl font-bold text-white">Nouvelle ligue</h1>
        </div>

        <CreateLeagueForm />
      </div>
    </main>
  )
}
