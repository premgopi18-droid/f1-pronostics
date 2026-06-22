"use client";

import { useRef, type KeyboardEvent } from "react";
import { AvatarHelmet } from "@/app/ui/avatar-helmet";
import { HELMETS } from "@/lib/profile/avatars";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

const HELMET_SIZE = 56; // px — taille d'un casque dans la grille

/**
 * Grille de sélection de casque (contrôlée). Partagée par l'onboarding et le profil.
 * Sémantique radiogroup conforme WAI-ARIA : un seul élément tabbable (roving tabindex)
 * et navigation aux flèches (+ Home/End), en plus du clic.
 */
export function HelmetPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string) => void;
}) {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  // Élément actif dans l'ordre de tabulation : le casque sélectionné, ou le premier
  // si aucun ne l'est encore — pour entrer dans la grille en un seul Tab.
  const selectedIndex = HELMETS.findIndex((helmet) => helmet.id === value);
  const activeIndex = selectedIndex === -1 ? 0 : selectedIndex;

  // Flèches/Home/End : déplacent la sélection (avec rebouclage) et le focus.
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const lastIndex = HELMETS.length - 1;
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = index === lastIndex ? 0 : index + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = index === 0 ? lastIndex : index - 1;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = lastIndex;
        break;
      default:
        return;
    }
    event.preventDefault();
    onChange(HELMETS[nextIndex].id);
    buttonsRef.current[nextIndex]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("avatar.pickLegend")}
      className="grid grid-cols-4 gap-3.5"
    >
      {HELMETS.map((helmet, index) => {
        const selected = value === helmet.id;
        return (
          <button
            key={helmet.id}
            ref={(node) => {
              buttonsRef.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t(helmet.labelKey)}
            tabIndex={index === activeIndex ? 0 : -1}
            onClick={() => onChange(helmet.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
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
