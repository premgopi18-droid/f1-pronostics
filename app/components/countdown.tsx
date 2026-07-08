"use client";

import { useEffect, useState } from "react";
import { formatCountdownLabel, remaining } from "@/lib/countdown";
import { t } from "@/lib/i18n";

const TICK_MS = 30_000;

/**
 * Compte à rebours jusqu'à `targetIso`. L'intervalle force un re-render (pas de
 * setState synchrone dans l'effet) ; le calcul dépend de `Date.now()` → les valeurs
 * sont marquées `suppressHydrationWarning` (décalage SSR/client inhérent et bénin).
 */
export function Countdown({ targetIso }: { targetIso: string }) {
  const target = new Date(targetIso).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const timeLeft = remaining(target, now);
  const { days, hours, mins } = timeLeft;
  const cells: ReadonlyArray<readonly [number, string]> = [
    [days, t("home.countdownDays")],
    [hours, t("home.countdownHours")],
    [mins, t("home.countdownMins")],
  ];

  return (
    // Lecteurs d'écran : une seule phrase (role timer + aria-label), lue à la
    // navigation — jamais d'aria-live, un countdown qui s'annonce à chaque tick
    // serait du bruit. Les cellules visuelles sont masquées (aria-hidden).
    // suppressHydrationWarning : l'aria-label dépend de Date.now(), comme les
    // chiffres — décalage SSR/client inhérent et bénin.
    <div
      role="timer"
      aria-label={formatCountdownLabel(timeLeft)}
      suppressHydrationWarning
      className="flex gap-2"
    >
      {cells.map(([n, label]) => (
        <div key={label} aria-hidden="true" className="flex-1 rounded-xl bg-black/25 p-2.5 text-center">
          <div className="font-numeric text-2xl font-bold text-foreground" suppressHydrationWarning>
            {n}
          </div>
          <div className="text-2xs uppercase tracking-wider text-text-muted">{label}</div>
        </div>
      ))}
    </div>
  );
}
