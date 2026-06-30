// Constantes taille de police partagées serveur ⇄ client. NE PAS ajouter 'use client' ici.
// Le boot script anti-FOUC du layout (Server Component) interpole ces valeurs.

export type FontSizeOption = 'normal' | 'large' | 'xlarge'

export const FONT_SIZE_STORAGE_KEY = 'font-size-override'

export const FONT_SIZE_OPTIONS: readonly FontSizeOption[] = ['normal', 'large', 'xlarge']

// Map option → classe posée sur <html>. `normal` vaut une chaîne vide *volontairement* :
// c'est la sentinelle « aucune classe à poser » (la taille par défaut vient du CSS racine).
// Tout consommateur doit donc garder le réflexe de garder cette valeur (`if (cls) …`) avant
// de l'ajouter/retirer — cf. applyFontSize (use-font-size.ts) et le boot script du layout.
export const FONT_SIZE_CLASS: Record<FontSizeOption, string> = {
  normal: '',
  large:  'font-size-lg',
  xlarge: 'font-size-xl',
}
