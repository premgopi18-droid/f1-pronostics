/** Présentation d'un delta de points — partagé par les faits marquants et le détail joueur. */

export type DeltaKind = 'pos' | 'neg' | 'nil'

/** Format signé avec le vrai signe moins typographique (U+2212) : `+8`, `−8`, `0`. */
export function formatSignedDelta(value: number): string {
  if (value > 0) return `+${value}`
  if (value < 0) return `−${Math.abs(value)}`
  return '0'
}

export function deltaKind(value: number): DeltaKind {
  if (value > 0) return 'pos'
  if (value < 0) return 'neg'
  return 'nil'
}
