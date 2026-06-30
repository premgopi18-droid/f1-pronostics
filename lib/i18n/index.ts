import { fr } from "./fr";

/** Forme du catalogue de messages (dérivée de la locale FR). */
export type Messages = typeof fr;

/** Clés en notation pointée, typées récursivement depuis le catalogue. */
type DotKeys<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? DotKeys<T[K], `${Prefix}${K}.`>
    : `${Prefix}${K}`;
}[keyof T & string];

export type TranslationKey = DotKeys<Messages>;

/**
 * Résout une clé de traduction (ex. `t('avatar.helmetAlt')`).
 *
 * Interpolation optionnelle : `t('gpResults.chainWildSteal', { actor: 'Lena' })`
 * remplace les `{placeholder}` du message. Primitive unique — les écrans n'ont pas
 * à réimplémenter leur propre interpolation.
 *
 * Locale FR figée pour l'instant. Quand une 2e langue arrive, on remplace
 * l'implémentation (ex. next-intl) sans changer les appels côté composants.
 */
export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
  const message = key
    .split(".")
    .reduce<unknown>((node, segment) => (node as Record<string, unknown>)?.[segment], fr) as string;
  if (!vars) return message;
  return message.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ""));
}
