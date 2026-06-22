import type { TranslationKey } from "@/lib/i18n";

/**
 * Catalogue des avatars « casque F1 » prédéfinis.
 * `avatar_key` (table profiles) stocke l'`id` d'un casque ci-dessous.
 * Le libellé passe par i18n (`labelKey`) — pas de texte d'affichage en dur.
 */
export interface Helmet {
  id: string;
  /** Couleur principale du casque (token de données, pas de thème). */
  color: string;
  labelKey: TranslationKey;
}

export const HELMETS = [
  { id: "red", color: "#E10600", labelKey: "avatar.colors.red" },
  { id: "orange", color: "#FF8000", labelKey: "avatar.colors.orange" },
  { id: "amber", color: "#F2C94C", labelKey: "avatar.colors.amber" },
  { id: "green", color: "#22C55E", labelKey: "avatar.colors.green" },
  { id: "teal", color: "#00D2BE", labelKey: "avatar.colors.teal" },
  { id: "cyan", color: "#29B6F6", labelKey: "avatar.colors.cyan" },
  { id: "blue", color: "#1E5BFF", labelKey: "avatar.colors.blue" },
  { id: "indigo", color: "#6C5CE7", labelKey: "avatar.colors.indigo" },
  { id: "purple", color: "#9B51E0", labelKey: "avatar.colors.purple" },
  { id: "pink", color: "#FF4F8B", labelKey: "avatar.colors.pink" },
  { id: "white", color: "#E6E6E6", labelKey: "avatar.colors.white" },
  { id: "slate", color: "#8792A2", labelKey: "avatar.colors.slate" },
] as const satisfies readonly Helmet[];

export const HELMET_IDS: readonly string[] = HELMETS.map((helmet) => helmet.id);

/** Casque par défaut quand `avatar_key` est absent ou inconnu (ancien emoji, etc.). */
export const DEFAULT_HELMET: Helmet = HELMETS[0];

const HELMET_BY_ID = new Map<string, Helmet>(HELMETS.map((helmet) => [helmet.id, helmet]));

export function getHelmet(avatarKey: string | null | undefined): Helmet | undefined {
  return avatarKey ? HELMET_BY_ID.get(avatarKey) : undefined;
}
