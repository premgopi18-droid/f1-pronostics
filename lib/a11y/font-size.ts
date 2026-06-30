// Constantes taille de police partagées serveur ⇄ client. NE PAS ajouter 'use client' ici.
// Le boot script anti-FOUC du layout (Server Component) interpole ces valeurs.

export type FontSizeOption = 'normal' | 'large' | 'xlarge'

export const FONT_SIZE_STORAGE_KEY = 'font-size-override'

export const FONT_SIZE_OPTIONS: readonly FontSizeOption[] = ['normal', 'large', 'xlarge']

// Classe posée sur <html>. Chaîne vide pour 'normal' (pas de classe à poser).
export const FONT_SIZE_CLASS: Record<FontSizeOption, string> = {
  normal: '',
  large:  'font-size-lg',
  xlarge: 'font-size-xl',
}
