'use client'

import { useState, useEffect } from 'react'

export function InviteLink({ code }: { code: string }) {
  const [fullUrl, setFullUrl] = useState('')
  const [copied, setCopied]   = useState(false)

  useEffect(() => {
    setFullUrl(`${window.location.origin}/leagues/join?code=${code}`)
  }, [code])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard indisponible (permission refusée, contexte non sécurisé) — pas de feedback positif
    }
  }

  const displayUrl = fullUrl || `/leagues/join?code=${code}`

  return (
    <div className="bg-zinc-900 rounded-xl p-4 flex flex-col gap-3">
      <p className="text-sm text-zinc-400">Lien d'invitation</p>
      <div className="flex items-center gap-2">
        <code className="text-zinc-300 text-sm font-mono bg-zinc-800 rounded px-3 py-1.5 flex-1 truncate min-w-0">
          {displayUrl}
        </code>
        <button
          onClick={copy}
          disabled={!fullUrl}
          className="text-sm bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 transition-colors shrink-0 cursor-pointer"
        >
          {copied ? 'Copié !' : 'Copier'}
        </button>
      </div>
      <p className="text-zinc-600 text-xs">
        Code : <span className="font-mono tracking-wider">{code}</span>
      </p>
    </div>
  )
}
