'use client'

import { useFormStatus } from 'react-dom'

export function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg px-4 py-2.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
    >
      {pending ? 'Chargement…' : label}
    </button>
  )
}
