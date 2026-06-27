'use client'

import { useState, useEffect } from 'react'
// Constantes dans un module non-`'use client'` (cf. lib/theme/themes.ts) pour rester
// lisibles depuis le layout serveur. Importer les constantes directement de là, pas via
// ce hook : passer par un module `'use client'` côté serveur les transforme en
// références client (sérialisées en `undefined`).
import { THEME_STORAGE_KEY, THEMES, THEME_PRIMARY_COLORS, type ThemeId } from '@/lib/theme/themes'

const THEME_EVENT = 'theme-change'

export function getStoredTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (raw && THEMES.some((t) => t.id === raw)) return raw as ThemeId
  } catch {}
  return 'boxbox'
}

export function applyTheme(theme: ThemeId): void {
  if (theme === 'boxbox') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', theme)
  }
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_PRIMARY_COLORS[theme])
}

export function setTheme(theme: ThemeId): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {}
  applyTheme(theme)
  window.dispatchEvent(new CustomEvent<ThemeId>(THEME_EVENT, { detail: theme }))
}

export function useTheme(): [ThemeId, (t: ThemeId) => void] {
  const [theme, setThemeState] = useState<ThemeId>('boxbox')

  useEffect(() => {
    // Resync depuis le storage : au montage, sur changement même onglet
    // (`theme-change`), et entre onglets (`storage`). Sur le cross-onglet on
    // réapplique aussi l'attribut `data-theme` car il n'est posé que dans le
    // tab qui a déclenché le changement.
    const syncFromStorage = (e?: StorageEvent) => {
      // Event `storage` : ne resync que si c'est notre clé (ou un clear, key=null).
      // Appel direct au montage (e=undefined) : on resync toujours.
      if (e && e.key !== null && e.key !== THEME_STORAGE_KEY) return
      const stored = getStoredTheme()
      setThemeState(stored)
      applyTheme(stored)
    }
    syncFromStorage()
    const handler = (e: Event) => setThemeState((e as CustomEvent<ThemeId>).detail)
    window.addEventListener(THEME_EVENT, handler)
    window.addEventListener('storage', syncFromStorage)
    return () => {
      window.removeEventListener(THEME_EVENT, handler)
      window.removeEventListener('storage', syncFromStorage)
    }
  }, [])

  // `setTheme` dispatch `theme-change` de façon synchrone → le handler ci-dessus
  // met à jour l'état ; pas besoin d'un `setThemeState` explicite ici.
  function changeTheme(t: ThemeId) {
    setTheme(t)
  }

  return [theme, changeTheme]
}
