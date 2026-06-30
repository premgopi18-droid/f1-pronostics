import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { itemEmoji, itemName } from "@/lib/items/catalog";
import { type GpItemType } from "@/lib/leagues/league-list";

export function ItemBubble({
  itemType,
  usesRemaining,
}: {
  itemType: GpItemType;
  usesRemaining: number;
}) {
  const exhausted = usesRemaining === 0;
  return (
    <div
      className={cn("flex flex-col items-center gap-0.5", exhausted && "opacity-35")}
      aria-label={`${itemName(itemType)} — ${usesRemaining} ${usesRemaining > 1 ? t("leagues.remainingPlural") : t("leagues.remaining")}`}
    >
      <span className="text-xl leading-none" aria-hidden>
        {itemEmoji(itemType)}
      </span>
      <span className="font-numeric text-2xs font-semibold text-text-secondary tabular-nums">
        {usesRemaining}
      </span>
    </div>
  );
}
