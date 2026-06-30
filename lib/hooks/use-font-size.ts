'use client'

import { useState, useEffect } from 'react'
import {
  FONT_SIZE_STORAGE_KEY,
  FONT_SIZE_CLASS,
  FONT_SIZE_OPTIONS,
  type FontSizeOption,
} from '@/lib/a11y/font-size'

const FONT_SIZE_EVENT = 'font-size-change'

export function getFontSizeOption(): FontSizeOption {
  const raw = localStorage.getItem(FONT_SIZE_STORAGE_KEY)
  if (raw === 'large' || raw === 'xlarge') return raw
  return 'normal'
}

export function applyFontSize(option: FontSizeOption): void {
  const html = document.documentElement
  for (const opt of FONT_SIZE_OPTIONS) {
    const cls = FONT_SIZE_CLASS[opt]
    if (cls) html.classList.remove(cls)
  }
  const targetClass = FONT_SIZE_CLASS[option]
  if (targetClass) html.classList.add(targetClass)
}

export function setFontSizeOption(option: FontSizeOption): void {
  localStorage.setItem(FONT_SIZE_STORAGE_KEY, option)
  applyFontSize(option)
  window.dispatchEvent(new Event(FONT_SIZE_EVENT))
}

export function useFontSize(): FontSizeOption {
  const [option, setOption] = useState<FontSizeOption>('normal')

  useEffect(() => {
    // Re-applique la classe en plus de l'état React : sur un event `storage`
    // (changement venu d'un autre onglet), le DOM de cet onglet doit suivre, pas
    // seulement le sélecteur. En same-tab c'est idempotent (déjà posée par setFontSizeOption).
    const sync = () => {
      const next = getFontSizeOption()
      setOption(next)
      applyFontSize(next)
    }
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener(FONT_SIZE_EVENT, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(FONT_SIZE_EVENT, sync)
    }
  }, [])

  return option
}
