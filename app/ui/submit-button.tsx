'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { Button, type ButtonProps } from '@/app/ui/button'
import { Spinner } from '@/app/ui/spinner'

type SubmitButtonProps = Pick<ButtonProps, 'variant' | 'size'> & {
  label: string
  /** Icône optionnelle affichée avant le label, remplacée par le spinner pendant la soumission. */
  icon?: ReactNode
}

// Bouton de soumission générique pour les <form> à Server Action : désactivé +
// spinner pendant la soumission (via useFormStatus). `aria-busy` annonce l'état
// occupé aux lecteurs d'écran, le label restant inchangé.
export function SubmitButton({ label, icon, variant, size }: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} aria-busy={pending}>
      {pending ? <Spinner /> : icon}
      {label}
    </Button>
  )
}