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
  const message = resolveMessage(key);
  if (message === null) return key;
  if (!vars) return message;
  return message.replace(/\{(\w+)\}/g, (_, name: string) => {
    warnMissingVar(key, name, vars);
    return String(vars[name] ?? "");
  });
}

/** Segment d'un message interpolé — `emphasis` marque une valeur substituée. */
export interface MessageSegment {
  text: string;
  emphasis: boolean;
}

/**
 * Variante de `t()` qui préserve la frontière texte/valeur : chaque placeholder
 * substitué devient un segment `emphasis: true`, le texte fixe des segments
 * `emphasis: false`. Permet aux composants de mettre les valeurs en valeur
 * (ex. `<strong>`) sans balisage dans le catalogue ni interpolation maison.
 */
export function tSegments(
  key: TranslationKey,
  vars: Record<string, string | number>,
): MessageSegment[] {
  const message = resolveMessage(key);
  if (message === null) return [{ text: key, emphasis: false }];

  const segments: MessageSegment[] = [];
  const pattern = /\{(\w+)\}/g;
  let cursor = 0;
  for (let match = pattern.exec(message); match !== null; match = pattern.exec(message)) {
    if (match.index > cursor) segments.push({ text: message.slice(cursor, match.index), emphasis: false });
    warnMissingVar(key, match[1], vars);
    segments.push({ text: String(vars[match[1]] ?? ""), emphasis: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < message.length) segments.push({ text: message.slice(cursor), emphasis: false });
  return segments;
}

function resolveMessage(key: TranslationKey): string | null {
  const message = key
    .split(".")
    .reduce<unknown>((node, segment) => (node as Record<string, unknown>)?.[segment], fr);
  // Clé introuvable — possible malgré le typage via un cast `as TranslationKey`
  // sur clé dynamique ou une clé supprimée du catalogue (#228, vécu sur
  // `predict.tab.*`) : crier en dev, rendre la clé brute plutôt qu'`undefined`.
  if (typeof message !== "string") {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[i18n] clé introuvable : ${key}`);
    }
    return null;
  }
  return message;
}

function warnMissingVar(
  key: TranslationKey,
  name: string,
  vars: Record<string, string | number>,
): void {
  if (process.env.NODE_ENV !== "production" && vars[name] === undefined) {
    console.error(`[i18n] placeholder {${name}} non fourni pour la clé ${key}`);
  }
}
