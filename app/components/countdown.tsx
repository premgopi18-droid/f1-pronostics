"use client";

import { useEffect, useState } from "react";
import { remaining } from "@/lib/countdown";
import { t } from "@/lib/i18n";

const TICK_MS = 30_000;

/**
 * Compte à rebours jusqu'à `targetIso`. L'intervalle force un re-render (pas de
 * setState synchrone dans l'effet) ; le calcul dépend de `Date.now()` → les valeurs
 * sont marquées `suppressHydrationWarning` (décalage SSR/client inhérent et bénin).
 */
export function Countdown({ targetIso }: { targetIso: string }) {
  const target = new Date(targetIso).getTime();
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const { days, hours, mins } = remaining(target, Date.now());
  const cells: ReadonlyArray<readonly [number, string]> = [
    [days, t("home.countdownDays")],
    [hours, t("home.countdownHours")],
    [mins, t("home.countdownMins")],
  ];

  return (
    <div className="flex gap-2">
      {cells.map(([n, label]) => (
        <div key={label} className="flex-1 rounded-xl bg-black/25 p-2.5 text-center">
          <div className="font-numeric text-2xl font-bold text-foreground" suppressHydrationWarning>
            {n}
          </div>
          <div className="text-2xs uppercase tracking-wider text-text-muted">{label}</div>
        </div>
      ))}
    </div>
  );
}
