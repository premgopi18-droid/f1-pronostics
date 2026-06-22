/** Construit l'ordre initial pour la course : entrées existantes d'abord, pilotes manquants ensuite. */
export function buildRaceOrder(existingEntries: string[], allCodes: string[]): string[] {
  return [...existingEntries, ...allCodes.filter((c) => !existingEntries.includes(c))]
}

/** Construit le label d'un onglet de session selon son état. */
export function buildTabLabel(baseLabel: string, hasSaved: boolean, isActive: boolean): string {
  if (hasSaved) return `✓ ${baseLabel}`
  if (isActive) return `• ${baseLabel}`
  return baseLabel
}
