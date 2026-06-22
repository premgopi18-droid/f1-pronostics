import Link from "next/link";
import { Card, CardTitle } from "@/app/ui/card";
import { Badge } from "@/app/ui/badge";
import { buttonVariants } from "@/app/ui/button";
import { cn } from "@/lib/utils";
import { t, type TranslationKey } from "@/lib/i18n";
import type { WeekendSession } from "@/lib/home-phase";
import type { SessionType } from "@/lib/scoring/types";

const SESSION_LABEL_KEY: Record<SessionType, TranslationKey> = {
  qualifying: "home.session.qualifying",
  race: "home.session.race",
  sprint_qualifying: "home.session.sprintQualifying",
  sprint_race: "home.session.sprint",
};

export function GpWeekendCard({
  name,
  gpId,
  sessions,
}: {
  name: string;
  gpId: string;
  sessions: ReadonlyArray<WeekendSession>;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <CardTitle>{name}</CardTitle>
        <Badge variant="warning">{t("home.weekendInProgress")}</Badge>
      </div>

      <ul className="mt-3 flex flex-col">
        {sessions.map((session, index) => {
          const locked = session.lockState === "locked";
          return (
            <li
              key={`${session.type}-${index}`}
              className="flex items-center justify-between border-t border-border py-2.5 first:border-t-0"
            >
              <span className="text-sm font-medium text-foreground">
                {t(SESSION_LABEL_KEY[session.type])}
              </span>
              <Badge variant={locked ? "neutral" : "warning"}>
                {locked ? t("home.sessionLocked") : t("home.sessionOpen")}
              </Badge>
            </li>
          );
        })}
      </ul>

      <Link href={`/predictions/${gpId}`} className={cn(buttonVariants({ size: "block" }), "mt-4")}>
        {t("home.modifyPredictions")} <span aria-hidden="true">→</span>
      </Link>
    </Card>
  );
}
