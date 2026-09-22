'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Button, buttonVariants } from '@/app/ui/button'
import { t } from '@/lib/i18n'

/** Taille de l'icône d'état (badge carré 56px). */
const STATUS_ICON_SIZE = 26

// Écran d'erreur de rendu (boundary Next `error.tsx`, #241) : remplace l'écran brut
// de Next par un état dans la charte, avec relance du segment (`reset`) et retour à
// l'accueil. Le détail technique part dans la console, jamais à l'écran (convention
// erreurs du projet) ; seul le `digest` Next est affiché pour recouper les logs Vercel.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app] erreur de rendu', error)
  }, [error])

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-page py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive-soft">
        <TriangleAlert size={STATUS_ICON_SIZE} className="text-destructive" aria-hidden />
      </span>
      <h1 className="font-display text-2xl font-bold text-foreground">{t('errorPage.title')}</h1>
      <p className="max-w-xs text-sm text-text-secondary">{t('errorPage.text')}</p>
      <div className="mt-2 flex w-full max-w-xs flex-col gap-3">
        <Button size="block" onClick={reset}>
          {t('errorPage.retry')}
        </Button>
        <Link href="/" className={buttonVariants({ variant: 'secondary', size: 'block' })}>
          {t('errorPage.home')}
        </Link>
      </div>
      {error.digest && (
        <p className="text-2xs text-text-muted">
          {t('errorPage.reference')} <span className="font-mono">{error.digest}</span>
        </p>
      )}
    </main>
  )
}
