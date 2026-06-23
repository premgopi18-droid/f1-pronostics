'use client'

import { useState, useEffect } from 'react'

export const THEME_STORAGE_KEY = 'app-theme'
const THEME_EVENT = 'theme-change'

export type ThemeId = 'boxbox' | 'ferrari' | 'mercedes' | 'mclaren' | 'redbull' | 'aston'

export const THEMES: { id: ThemeId; label: string; primary: string }[] = [
  { id: 'boxbox',   label: 'BoxBox',       primary: '#FF1801' },
  { id: 'ferrari',  label: 'Ferrari',      primary: '#DC0000' },
  { id: 'mercedes', label: 'Mercedes',     primary: '#00D2BE' },
  { id: 'mclaren',  label: 'McLaren',      primary: '#FF8000' },
  { id: 'redbull',  label: 'Red Bull',     primary: '#3671C6' },
  { id: 'aston',    label: 'Aston Martin', primary: '#006E51' },
]

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
    setThemeState(getStoredTheme())
    const handler = (e: Event) => setThemeState((e as CustomEvent<ThemeId>).detail)
    window.addEventListener(THEME_EVENT, handler)
    return () => window.removeEventListener(THEME_EVENT, handler)
  }, [])

  function changeTheme(t: ThemeId) {
    setThemeState(t)
    setTheme(t)
  }

  return [theme, changeTheme]
}
