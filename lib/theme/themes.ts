// Constantes de thème partagées serveur ⇄ client. NE PAS ajouter 'use client' ici :
// le boot script anti-FOUC du layout (Server Component) interpole ces valeurs dans
// une string. Si elles venaient d'un module 'use client', le serveur ne recevrait que
// des références client (sérialisées en `undefined`) au lieu des vraies valeurs.

export const THEME_STORAGE_KEY = 'app-theme'

export type ThemeId = 'boxbox' | 'ferrari' | 'mercedes' | 'mclaren' | 'redbull' | 'aston'

// Les libellés affichés viennent de l'i18n (`theme.themes.<id>`), pas d'ici —
// `primary` sert à la pastille de couleur (swatch) du sélecteur.
export const THEMES: { id: ThemeId; primary: string }[] = [
  { id: 'boxbox',   primary: '#E10600' },
  { id: 'ferrari',  primary: '#DC0000' },
  { id: 'mercedes', primary: '#00D2BE' },
  { id: 'mclaren',  primary: '#FF8000' },
  { id: 'redbull',  primary: '#3671C6' },
  { id: 'aston',    primary: '#006E51' },
]

export const THEME_PRIMARY_COLORS: Record<ThemeId, string> = Object.fromEntries(
  THEMES.map((t) => [t.id, t.primary]),
) as Record<ThemeId, string>
