import { cn } from "@/lib/utils";

export interface AvatarHelmetProps {
  /** Couleur principale du casque (ex. `#FF1801`) */
  color: string;
  /** Diamètre en px (défaut 40) */
  size?: number;
  /** Texte alternatif accessible (ex. le pseudo). Décoratif si omis. */
  label?: string;
  className?: string;
}

/**
 * Avatar « casque F1 » stylisé flat — visière + reflet.
 * Réutilisé partout : nav, podium, profil, classements, comparaisons.
 * Couleur et taille sont dynamiques → styles inline (impossible en classes Tailwind).
 */
export function AvatarHelmet({ color, size = 40, label, className }: AvatarHelmetProps) {
  return (
    <span
      role="img"
      aria-label={label ?? "Avatar casque"}
      className={cn("relative block shrink-0 overflow-hidden rounded-full", className)}
      style={{
        width: size,
        height: size,
        background: color,
        boxShadow: `inset 0 ${-size * 0.15}px ${size * 0.3}px rgba(0,0,0,.35)`,
      }}
    >
      {/* visière */}
      <span
        aria-hidden
        className="absolute rounded-md"
        style={{ left: "14%", right: "14%", top: "38%", height: "24%", background: "rgba(0,0,0,.45)" }}
      />
      {/* reflet */}
      <span
        aria-hidden
        className="absolute"
        style={{ left: 0, right: 0, top: "14%", height: "18%", background: "rgba(255,255,255,.18)" }}
      />
    </span>
  );
}
