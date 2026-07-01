import { AvatarHelmet } from "@/app/ui/avatar-helmet";
import { getHelmet, DEFAULT_HELMET } from "@/lib/profile/avatars";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

/** Épaisseur de l'anneau = ratio du diamètre (lisible de la nav ~40px au profil ~96px). */
const RING_RATIO = 0.075;
/** Anneau minimal en px pour rester visible aux très petites tailles. */
const MIN_RING = 2;

/**
 * Affiche l'avatar d'un utilisateur — source unique pour tous les sites d'affichage
 * (nav, podium, classements, révélation items, comparaisons).
 *
 * - `avatar_url` présent → photo circulaire cerclée de la couleur du casque (`avatar_key`).
 * - sinon → casque coloré (`AvatarHelmet`). L'anneau et le casque étant de la même
 *   couleur dans ce cas, le rendu reste homogène (même diamètre) sans wrapper superflu.
 */
export function UserAvatar({
  avatarKey,
  avatarUrl,
  size = 40,
  label,
  className,
}: {
  avatarKey: string | null | undefined;
  /** URL publique de la photo perso, ou null/absent si l'utilisateur n'en a pas. */
  avatarUrl?: string | null;
  size?: number;
  /** Nom accessible — typiquement le pseudo de l'utilisateur. */
  label?: string;
  className?: string;
}) {
  const helmet = getHelmet(avatarKey) ?? DEFAULT_HELMET;

  if (!avatarUrl) {
    return <AvatarHelmet color={helmet.color} size={size} label={label} className={className} />;
  }

  // Photo : disque intérieur, anneau = padding proportionnel rempli par la couleur du casque.
  const ring = Math.max(MIN_RING, Math.round(size * RING_RATIO));
  return (
    <span
      role="img"
      aria-label={label ?? t("avatar.photoAlt")}
      className={cn("relative block shrink-0 rounded-full", className)}
      style={{ width: size, height: size, background: helmet.color, padding: ring }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- avatar Storage public, taille fixe : <img> évite la config remotePatterns de next/image */}
      <img
        src={avatarUrl}
        alt=""
        className="block h-full w-full rounded-full object-cover"
      />
    </span>
  );
}
