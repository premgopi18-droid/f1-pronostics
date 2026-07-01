import type { TranslationKey } from "@/lib/i18n";

/**
 * Traitement des photos d'avatar — 100 % côté navigateur (cf. specs §Avatar).
 * Ce module sépare la logique pure (validation, format, chemin — testable en Node)
 * des fonctions dépendantes du DOM (canvas/Image — navigateur uniquement).
 */

/** Taille maximale du fichier d'ENTRÉE accepté (avant compression). */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 Mo
/** Côté du carré final stocké (px). */
export const AVATAR_OUTPUT_SIZE = 256;
/** Qualité de compression (WebP/JPEG). */
export const AVATAR_OUTPUT_QUALITY = 0.8;

export type AvatarOutputType = "image/webp" | "image/jpeg";

// ── Logique pure (testable) ──────────────────────────────────────────────────

/** Valide un fichier choisi. Renvoie une clé i18n d'erreur, ou null si OK. */
export function validateAvatarFile(file: { type: string; size: number }): TranslationKey | null {
  if (!file.type.startsWith("image/")) return "avatar.photo.errorNotImage";
  if (file.size > MAX_AVATAR_BYTES) return "avatar.photo.errorTooLarge";
  return null;
}

/** Extension de fichier correspondant au type MIME produit. */
export function extensionForType(type: string): string {
  if (type === "image/webp") return "webp";
  if (type === "image/png") return "png";
  return "jpg";
}

/** Chemin de l'objet Storage : `{userId}/{id}.{ext}` (id unique → cache-busting). */
export function buildAvatarObjectPath(userId: string, type: string, uniqueId: string): string {
  return `${userId}/${uniqueId}.${extensionForType(type)}`;
}

/**
 * Extrait le chemin de l'objet depuis une URL publique Supabase, pour pouvoir
 * supprimer l'ancien fichier au remplacement. Renvoie null si l'URL n'est pas
 * une URL publique du bucket `avatars`.
 */
export function objectPathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = "/storage/v1/object/public/avatars/";
  const index = url.indexOf(marker);
  return index === -1 ? null : url.slice(index + marker.length);
}

// ── Fonctions navigateur (DOM requis) ────────────────────────────────────────

/**
 * WebP si l'encodage `canvas.toBlob` est supporté, sinon JPEG (repli Safari/iOS
 * anciens, où WebP retombe silencieusement en PNG plus lourd).
 */
export function pickAvatarOutputType(): AvatarOutputType {
  const canvas = document.createElement("canvas");
  return canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0
    ? "image/webp"
    : "image/jpeg";
}

/**
 * Recadre `imageSrc` selon la zone `crop` (px, telle que fournie par react-easy-crop),
 * redimensionne en carré `size` et compresse. Renvoie le blob prêt à uploader.
 */
export async function cropAvatarToBlob(
  imageSrc: string,
  crop: { x: number; y: number; width: number; height: number },
  type: AvatarOutputType,
  size: number = AVATAR_OUTPUT_SIZE,
  quality: number = AVATAR_OUTPUT_QUALITY,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_context_unavailable");

  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, size, size);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas_toblob_failed"))),
      type,
      quality,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
