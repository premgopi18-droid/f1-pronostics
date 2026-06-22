export const PSEUDO_MIN_LENGTH = 3;
export const PSEUDO_MAX_LENGTH = 20;
/** Lettres, chiffres et underscore uniquement (spec §7). */
export const PSEUDO_PATTERN = /^[a-zA-Z0-9_]+$/;

/** Codes d'erreur (traduits côté UI via i18n — pas de message en dur ici). */
export type PseudoError = "length" | "chars";

/**
 * Valide un pseudo selon les règles produit. Retourne `null` si valide,
 * sinon un code d'erreur. La trim est laissée à l'appelant.
 */
export function validatePseudo(pseudo: string): PseudoError | null {
  if (pseudo.length < PSEUDO_MIN_LENGTH || pseudo.length > PSEUDO_MAX_LENGTH) {
    return "length";
  }
  if (!PSEUDO_PATTERN.test(pseudo)) {
    return "chars";
  }
  return null;
}
