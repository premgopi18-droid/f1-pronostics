import { Card } from "@/app/ui/card";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import type { PreviousGpCard as PreviousGpCardData } from "@/lib/data/home";

// Hauteur de marche par position + ordre d'affichage (2e · 1er au centre · 3e).
const STEP_HEIGHT: Record<number, string> = { 1: "h-12", 2: "h-9", 3: "h-7" };
const DISPLAY_ORDER = [2, 1, 3] as const;

export function PreviousGpCard({ card }: { card: PreviousGpCardData }) {
  const byPosition = new Map(card.podium.map((p) => [p.position, p]));

  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="text-2xs font-bold uppercase tracking-wider text-text-secondary">
          {t("home.previousGpLabel")}
        </span>
        <span className="text-sm font-semibold text-foreground">{card.name}</span>
      </div>

      {card.podium.length > 0 && (
        <div className="mt-4 flex items-end justify-center gap-3">
          {DISPLAY_ORDER.map((position) => {
            const entry = byPosition.get(position);
            if (!entry) return null;
            const isWinner = position === 1;
            return (
              <div key={position} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="text-xs font-semibold text-foreground">{entry.code}</div>
                <div
                  className={cn(
                    "flex w-full items-start justify-center rounded-t-lg pt-1.5",
                    STEP_HEIGHT[position],
                    isWinner ? "bg-gold-soft" : "bg-secondary",
                  )}
                >
                  <span
                    className={cn(
                      "font-display font-black",
                      isWinner ? "text-gold" : "text-text-secondary",
                    )}
                  >
                    {position}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {card.rawScore !== null && (
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3.5">
          <span className="text-sm text-text-secondary">{t("home.rawScore")}</span>
          <span className="font-display text-lg font-bold text-foreground">
            <span className="font-numeric">{card.rawScore}</span>{" "}
            <span className="text-xs font-medium text-text-secondary">{t("home.points")}</span>
          </span>
        </div>
      )}
    </Card>
  );
}
