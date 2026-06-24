import Link from "next/link";
import { Trophy } from "lucide-react";
import { Card } from "@/app/ui/card";
import { Badge } from "@/app/ui/badge";
import { JoinPreviewButton } from "./join-preview-button";
import { t } from "@/lib/i18n";
import type { LeaguePreview } from "@/lib/data/leagues";

/** Landing d'invitation : aperçu de la ligue + état (ouvert / complète / fermée / invalide). */
export function JoinPreview({ preview, code }: { preview: LeaguePreview; code: string }) {
  if (preview.status === "not_found") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="font-display text-xl font-bold text-foreground">
          {t("join.notFoundTitle")}
        </h1>
        <p className="mt-2 max-w-xs text-sm text-text-secondary">{t("join.notFoundText")}</p>
      </div>
    );
  }

  const { id, name, memberCount, maxMembers, adminPseudo, season, status } = preview;

  return (
    <div className="flex flex-1 flex-col">
      <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">
        {t("join.invitationLabel")}
      </p>

      <Card variant="gradient" className="mt-4 text-center">
        <Trophy size={34} className="mx-auto text-gold" aria-hidden />
        <div className="mt-2.5 font-display text-2xl font-bold text-foreground">{name}</div>
        {adminPseudo && (
          <div className="mt-1.5 text-sm text-text-secondary">
            {t("join.adminLabel")} · {adminPseudo}
          </div>
        )}
        <div className="mt-4 flex items-center justify-center gap-5">
          <div>
            <div className="font-display text-xl font-bold text-foreground">
              <span className="font-numeric">{memberCount}</span>
              <span className="text-text-muted">/{maxMembers}</span>
            </div>
            <div className="mt-0.5 text-2xs text-text-muted">{t("join.members")}</div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <div className="font-display text-base font-bold text-foreground">
              {t("join.seasonLabel")} {season}
            </div>
            <div className="mt-0.5 text-2xs text-text-muted">{t("join.seasonInProgress")}</div>
          </div>
        </div>
      </Card>

      {status === "open" && (
        <>
          <p className="mt-4 rounded-xl bg-accent-soft px-4 py-3.5 text-sm leading-relaxed text-text-secondary">
            {t("join.blurb")}
          </p>
          <JoinPreviewButton code={code} />
        </>
      )}

      {status === "full" && (
        <StateNote variant="neutral" title={t("join.fullTitle")} text={t("join.fullText")} />
      )}
      {status === "closed" && (
        <StateNote variant="warning" title={t("join.closedTitle")} text={t("join.closedText")} />
      )}
      {status === "already_member" && (
        <div className="mt-5 flex flex-col items-center gap-3 text-center">
          <Badge variant="neutral">{t("join.alreadyMemberTitle")}</Badge>
          <p className="max-w-xs text-sm text-text-secondary">{t("join.alreadyMemberText")}</p>
          <Link
            href={`/leagues/${id}`}
            className="mt-1 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            {t("join.alreadyMemberCta")} →
          </Link>
        </div>
      )}
    </div>
  );
}

function StateNote({
  variant,
  title,
  text,
}: {
  variant: "neutral" | "warning";
  title: string;
  text: string;
}) {
  return (
    <div className="mt-5 flex flex-col items-center gap-2 text-center">
      <Badge variant={variant}>{title}</Badge>
      <p className="max-w-xs text-sm text-text-secondary">{text}</p>
    </div>
  );
}
