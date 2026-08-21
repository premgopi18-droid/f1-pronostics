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
 *  pilotes hors grille ajoutés à la fin) ; sinon l'ordre des pilotes fourni.
 *
 *  Plafonné à `expectedCount` : la liste saison peut dépasser le nombre de
 *  partants (échange de baquet → 23 pilotes, cas Zandvoort 2026) alors que le
 *  serveur rejette tout envoi au-delà. `allCodes` arrive absents en fin de
 *  liste (tri de la page) → le surplus coupé est bien le pilote absent, qui
 *  démarre dans la section « non classés ». */
export function buildPrefilledRaceOrder(
  existingEntries: string[],
  gridOrder: string[],
  allCodes: string[],
  expectedCount: number,
): string[] {
  // Codes fantômes filtrés (#229) : un prono enregistré peut référencer un
  // pilote qui a disparu de la liste — le garder produirait une ligne invisible
  // qui éjecte un vrai partant via le cap et un envoi rejeté (unknownDriver).
  const knownEntries = existingEntries.filter((code) => allCodes.includes(code))
  const base = knownEntries.length > 0
    ? buildRaceOrder(knownEntries, allCodes)
    : buildRaceOrder(gridOrder.filter((code) => allCodes.includes(code)), allCodes)
  return base.slice(0, expectedCount)
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
  // Même filtrage des codes fantômes que le formulaire course (#229).
  const knownEntries = existingEntries.filter((code) => allCodes.includes(code))
  if (knownEntries.length > 0) return knownEntries
  return gridOrder.filter((code) => allCodes.includes(code)).slice(0, expectedCount)
}

/** Construit le label d'un onglet de session selon son état. */
export function buildTabLabel(baseLabel: string, hasSaved: boolean, isActive: boolean): string {
  if (hasSaved) return `✓ ${baseLabel}`
  if (isActive) return `• ${baseLabel}`
  return baseLabel
}
