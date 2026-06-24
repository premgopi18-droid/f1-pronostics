'use client'

import { useEffect, useId, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

interface BottomSheetProps {
  open:     boolean
  onClose:  () => void
  title:    string
  children: React.ReactNode
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const titleId    = useId()
  const panelRef   = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  // Garde la ref à jour sans en faire une dep d'effet (maj après commit, hors render)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const frame = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCloseRef.current(); return }
      if (e.key !== 'Tab') return

      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last  = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }

    document.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prev
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKey)
      // Restitue le focus au trigger à la fermeture (a11y clavier / lecteur d'écran)
      previouslyFocused?.focus()
    }
  }, [open])  // onClose lu via ref — pas de re-run parasite

  if (!open) return null

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/60 [animation:bx-fade_200ms_ease]"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-card [animation:bx-sheet_280ms_ease]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between border-b border-border px-4 pb-3 pt-4">
          <h2 id={titleId} className="text-sm font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-lg leading-none text-text-secondary hover:text-foreground"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </>
  )
}
