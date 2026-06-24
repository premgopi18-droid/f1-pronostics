"use client";

import { useActionState } from "react";
import { joinLeagueAction } from "@/app/actions/leagues";
import { Button } from "@/app/ui/button";
import { t, type TranslationKey } from "@/lib/i18n";

/** Bouton « Rejoindre » de la landing d'invitation — réutilise l'action existante. */
export function JoinPreviewButton({ code }: { code: string }) {
  const [state, action, isPending] = useActionState(joinLeagueAction, null);
  return (
    <form action={action} className="mt-auto">
      <input type="hidden" name="inviteCode" value={code} />
      {state?.errorCode && (
        <p className="mb-3 text-center text-xs text-destructive" aria-live="polite">
          {t(`join.error.${state.errorCode}` as TranslationKey)}
        </p>
      )}
      <Button type="submit" size="block" disabled={isPending}>
        {isPending ? t("common.loading") : t("join.cta")}
      </Button>
    </form>
  );
}
