import Link from "next/link";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { Badge } from "@/app/ui/badge";
import { Card } from "@/app/ui/card";
import { GP_ITEM_TYPES, GP_ITEM_EMOJI, type LeagueSummary, type GpItemType } from "@/lib/leagues/league-list";

/** Suffixe ordinal français : 1er, 2e, 3e… */
function ordinalSuffix(rank: number): string {
  return rank === 1 ? "er" : "e";
}

function ItemBubble({ itemType, usesRemaining }: { itemType: GpItemType; usesRemaining: number }) {
  const exhausted = usesRemaining === 0;
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-0.5",
        exhausted && "opacity-35",
      )}
      aria-label={`${t(`leagues.items.${itemType}` as Parameters<typeof t>[0])} — ${usesRemaining} ${usesRemaining > 1 ? t("leagues.remainingPlural") : t("leagues.remaining")}`}
    >
      <span className="text-xl leading-none" aria-hidden>
        {GP_ITEM_EMOJI[itemType]}
      </span>
      <span className="font-numeric text-2xs font-semibold text-text-secondary tabular-nums">
        {usesRemaining}
      </span>
    </div>
  );
}

export function LeagueCard({ league }: { league: LeagueSummary }) {
  const itemsByType = new Map(league.items.map((i) => [i.itemType, i.usesRemaining]));

  return (
    <Link
      href={`/leagues/${league.leagueId}`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-2xl"
      aria-label={`${league.name}${league.isAdmin ? ` — ${t("leagues.adminBadge")}` : ""}, ${t("leagues.rankAriaLabel")} ${league.myRank} ${t("leagues.rankAriaSeparator")} ${league.memberCount}, ${league.myPoints} ${t("leagues.seasonPoints")}`}
    >
      <Card className="flex flex-col gap-3">
        {/* Nom + badge admin */}
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-display text-lg font-bold leading-tight text-foreground">
            {league.name}
          </h2>
          {league.isAdmin && (
            <Badge variant="gold" className="shrink-0 self-start">
              {t("leagues.adminBadge")}
            </Badge>
          )}
        </div>

        {/* Rang + points */}
        <div className="flex items-end justify-between gap-2">
          <div className="flex items-baseline gap-1">
            <span className="font-numeric text-3xl font-bold leading-none text-foreground">
              {league.myRank}
            </span>
            <sup className="text-xs font-semibold text-text-muted leading-none">
              {ordinalSuffix(league.myRank)}
            </sup>
            <span className="text-sm text-text-secondary">
              / {league.memberCount} {t("leagues.members")}
            </span>
          </div>

          <div className="flex flex-col items-end">
            <span className="font-numeric text-2xl font-bold leading-none text-gold">
              {league.myPoints}
            </span>
            <span className="text-2xs text-text-muted mt-0.5">
              {t("leagues.seasonPoints")}
            </span>
          </div>
        </div>

        {/* Items GP — scroll horizontal si trop d'items à l'écran */}
        <div
          className="flex gap-3 overflow-x-auto pb-0.5 scrollbar-none"
          aria-label={t("leagues.itemsAvailable")}
          role="list"
        >
          {GP_ITEM_TYPES.map((itemType) => (
            <div key={itemType} role="listitem">
              <ItemBubble
                itemType={itemType}
                usesRemaining={itemsByType.get(itemType) ?? 0}
              />
            </div>
          ))}
        </div>
      </Card>
    </Link>
  );
}

/** Card CTA pour créer ou rejoindre une ligue supplémentaire. */
export function AddLeagueCard() {
  return (
    <Card className="flex flex-col items-center gap-4 py-6">
      <span className="text-4xl" aria-hidden>
        🏁
      </span>
      <p className="text-center text-sm text-text-secondary">
        {t("leagues.emptyText")}
      </p>
      <div className="flex w-full gap-3">
        <Link
          href="/leagues/new"
          className="flex h-11 flex-1 items-center justify-center rounded-xl border border-border bg-card text-sm font-semibold text-foreground transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {t("leagues.create")}
        </Link>
        <Link
          href="/leagues/join"
          className="flex h-11 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {t("leagues.join")}
        </Link>
      </div>
    </Card>
  );
}
