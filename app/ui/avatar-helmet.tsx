import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

/** Géométrie du casque (proportions du diamètre + opacités) — proto BoxBox. */
const HELMET = {
  shadowOffsetRatio: 0.15,
  shadowBlurRatio: 0.3,
  shadowColor: "rgba(0,0,0,.35)",
  visor: { left: "14%", right: "14%", top: "38%", height: "24%", color: "rgba(0,0,0,.45)" },
  reflection: { top: "14%", height: "18%", color: "rgba(255,255,255,.18)" },
} as const;

const DEFAULT_SIZE = 40;

export interface AvatarHelmetProps {
  /** Couleur principale du casque (ex. `#FF1801`) */
  color: string;
  /** Diamètre en px */
  size?: number;
  /** Texte alternatif accessible (ex. le pseudo). Libellé générique sinon. */
  label?: string;
  className?: string;
}

/**
 * Avatar « casque F1 » stylisé flat — visière + reflet.
 * Réutilisé partout : nav, podium, profil, classements, comparaisons.
 * Couleur et taille sont dynamiques → styles inline (impossible en classes Tailwind).
 */
export function AvatarHelmet({ color, size = DEFAULT_SIZE, label, className }: AvatarHelmetProps) {
  return (
    <span
      role="img"
      aria-label={label ?? t("avatar.helmetAlt")}
      className={cn("relative block shrink-0 overflow-hidden rounded-full", className)}
      style={{
        width: size,
        height: size,
        background: color,
        boxShadow: `inset 0 ${-size * HELMET.shadowOffsetRatio}px ${size * HELMET.shadowBlurRatio}px ${HELMET.shadowColor}`,
      }}
    >
      <span
        aria-hidden
        className="absolute rounded-md"
        style={{
          left: HELMET.visor.left,
          right: HELMET.visor.right,
          top: HELMET.visor.top,
          height: HELMET.visor.height,
          background: HELMET.visor.color,
        }}
      />
      <span
        aria-hidden
        className="absolute inset-x-0"
        style={{
          top: HELMET.reflection.top,
          height: HELMET.reflection.height,
          background: HELMET.reflection.color,
        }}
      />
    </span>
  );
}
