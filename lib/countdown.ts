import { t } from "@/lib/i18n";

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 60 * 24;

export type Remaining = { days: number; hours: number; mins: number };

/** Temps restant (jours/heures/min) entre `now` et `target`. Borné à zéro si dépassé. */
export function remaining(target: number, now: number): Remaining {
  const totalMinutes = Math.floor(Math.max(0, target - now) / MS_PER_MINUTE);
  return {
    days: Math.floor(totalMinutes / MINUTES_PER_DAY),
    hours: Math.floor((totalMinutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR),
    mins: totalMinutes % MINUTES_PER_HOUR,
  };
}

/**
 * Libellé lecteur d'écran du compte à rebours — une phrase complète, lue en une
 * fois quand l'utilisateur navigue sur le composant (jamais annoncée d'office :
 * pas d'aria-live sur un countdown). Unités abrégées (j/h/min) : pas de pluriel
 * à gérer, aligné sur les cellules visuelles.
 */
export function formatCountdownLabel({ days, hours, mins }: Remaining): string {
  return t("home.countdownAriaLabel", { days, hours, mins });
}
