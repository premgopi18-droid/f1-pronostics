'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type { SeasonForm } from './season-form'

// @dnd-kit génère des aria-describedby côté serveur avec un compteur qui diverge
// du client → hydration mismatch inévitable. On désactive le SSR pour ce composant.
const SeasonFormDynamic = dynamic(
  () => import('./season-form').then((m) => ({ default: m.SeasonForm })),
  {
    ssr:     false,
    loading: () => (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-11 rounded-xl bg-primary/10 animate-pulse" />
        ))}
      </div>
    ),
  },
)

export function SeasonFormLoader(props: ComponentProps<typeof SeasonForm>) {
  return <SeasonFormDynamic {...props} />
}
