"use client";

import { AvatarHelmet } from "@/app/ui/avatar-helmet";
import { HELMETS } from "@/lib/profile/avatars";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

const HELMET_SIZE = 56; // px — taille d'un casque dans la grille

/**
 * Grille de sélection de casque (contrôlée). Partagée par l'onboarding et le profil.
 * Sémantique radiogroup pour l'accessibilité (navigation clavier + lecteurs d'écran).
 */
export function HelmetPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={t("avatar.pickLegend")}
      className="grid grid-cols-4 gap-3.5"
    >
      {HELMETS.map((helmet) => {
        const selected = value === helmet.id;
        return (
          <button
            key={helmet.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t(helmet.labelKey)}
            onClick={() => onChange(helmet.id)}
            className={cn(
              "flex aspect-square items-center justify-center rounded-full transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selected && "ring-2 ring-primary",
            )}
          >
            <AvatarHelmet color={helmet.color} size={HELMET_SIZE} label="" />
          </button>
        );
      })}
    </div>
  );
}
