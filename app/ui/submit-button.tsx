'use client'

import { useFormStatus } from 'react-dom'
import { t } from '@/lib/i18n'

export function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()

  // Couleurs via tokens sémantiques (themeable) — pas de couleur en dur.
  // NB : migration vers la primitive Button prévue au re-skin de chaque page.
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg px-4 py-2.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? t('common.loading') : label}
    </button>
  )
}
