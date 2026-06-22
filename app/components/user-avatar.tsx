import { AvatarHelmet } from "@/app/ui/avatar-helmet";
import { getHelmet, DEFAULT_HELMET } from "@/lib/profile/avatars";

/**
 * Affiche l'avatar casque d'un utilisateur à partir de son `avatar_key`.
 * Source unique pour tous les sites d'affichage (nav, podium, classements, comparaisons).
 * Repli sur le casque par défaut si la clé est absente/inconnue.
 */
export function UserAvatar({
  avatarKey,
  size,
  label,
  className,
}: {
  avatarKey: string | null | undefined;
  size?: number;
  /** Nom accessible — typiquement le pseudo de l'utilisateur. */
  label?: string;
  className?: string;
}) {
  const helmet = getHelmet(avatarKey) ?? DEFAULT_HELMET;
  return <AvatarHelmet color={helmet.color} size={size} label={label} className={className} />;
}
