/** Construit l'ordre initial pour la course : entrées existantes d'abord, pilotes manquants ensuite. */
export function buildRaceOrder(existingEntries: string[], allCodes: string[]): string[] {
  return [...existingEntries, ...allCodes.filter((c) => !existingEntries.includes(c))]
}

/** Provenance de l'ordre de grille proposé : grille de départ réelle (OpenF1),
 *  ou classement des qualifications en fallback tant que la grille officielle
 *  n'est pas importée. */
export type GridSource = 'grid' | 'qualifying'

/** Le pré-remplissage grille s'applique-t-il ? Uniquement si l'utilisateur n'a
 *  AUCUN pronostic enregistré (on n'écrase jamais une saisie sauvegardée) et
 *  qu'un ordre de grille est connu. */
export function isGridPrefilled(existingEntries: string[], gridOrder: string[]): boolean {
  return existingEntries.length === 0 && gridOrder.length > 0
}

/** Ordre initial du formulaire course avec pré-remplissage grille : un prono
 *  enregistré est prioritaire ; sinon la grille (restreinte aux pilotes connus,
 *  pilotes hors grille ajoutés à la fin) ; sinon l'ordre des pilotes fourni. */
export function buildPrefilledRaceOrder(
  existingEntries: string[],
  gridOrder: string[],
  allCodes: string[],
): string[] {
  if (existingEntries.length > 0) return buildRaceOrder(existingEntries, allCodes)
  return buildRaceOrder(gridOrder.filter((code) => allCodes.includes(code)), allCodes)
}

/** Sélection initiale du formulaire « top N » (Sprint Race) avec pré-remplissage
 *  grille : un prono enregistré est prioritaire ; sinon les N premiers de la
 *  grille (restreinte aux pilotes connus) ; sinon une sélection vide. */
export function buildPrefilledTopEntries(
  existingEntries: string[],
  gridOrder: string[],
  allCodes: string[],
  expectedCount: number,
): string[] {
  if (existingEntries.length > 0) return existingEntries
  return gridOrder.filter((code) => allCodes.includes(code)).slice(0, expectedCount)
}

/** Construit le label d'un onglet de session selon son état. */
export function buildTabLabel(baseLabel: string, hasSaved: boolean, isActive: boolean): string {
  if (hasSaved) return `✓ ${baseLabel}`
  if (isActive) return `• ${baseLabel}`
  return baseLabel
}
