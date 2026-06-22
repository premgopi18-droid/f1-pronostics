"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft } from "lucide-react";
import {
  checkPseudoAvailability,
  completeOnboarding,
  type OnboardingError,
} from "@/app/actions/onboarding";
import { HelmetPicker } from "@/app/components/helmet-picker";
import { Button } from "@/app/ui/button";
import { cn } from "@/lib/utils";
import { t, type TranslationKey } from "@/lib/i18n";

const CHECK_DEBOUNCE_MS = 400;

const ERROR_KEY: Record<OnboardingError, TranslationKey> = {
  length: "onboarding.errorLength",
  chars: "onboarding.errorChars",
  taken: "onboarding.errorTaken",
  avatar: "onboarding.errorAvatar",
  generic: "onboarding.errorGeneric",
};

type Availability =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok" }
  | { status: "error"; error: OnboardingError };

export function OnboardingWizard() {
  const [step, setStep] = useState<1 | 2>(1);
  const [pseudo, setPseudo] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability>({ status: "idle" });
  const [state, formAction, isSubmitting] = useActionState(completeOnboarding, {});

  // Disponibilité du pseudo, débouncée. Un compteur ignore les réponses périmées.
  const requestId = useRef(0);
  useEffect(() => {
    const value = pseudo.trim();
    const id = ++requestId.current;
    if (!value) {
      setAvailability({ status: "idle" });
      return;
    }
    setAvailability({ status: "checking" });
    const timer = setTimeout(async () => {
      const result = await checkPseudoAvailability(value);
      if (id !== requestId.current) return; // réponse périmée
      setAvailability(result.ok ? { status: "ok" } : { status: "error", error: result.error! });
    }, CHECK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [pseudo]);

  // Si le pseudo a été pris entre l'étape 1 et la soumission (race tranchée par la
  // contrainte UNIQUE), ramener l'utilisateur au champ pseudo avec l'erreur affichée.
  useEffect(() => {
    if (state.error === "taken") {
      setStep(1);
      setAvailability({ status: "error", error: "taken" });
    }
  }, [state]);

  const canContinue = availability.status === "ok";

  return (
    <main className="flex min-h-dvh flex-col px-page pb-6 pt-8">
      {/* Indicateur de progression */}
      <div className="mb-8 flex items-center gap-3">
        {step === 2 && (
          <button
            type="button"
            onClick={() => setStep(1)}
            aria-label={t("common.back")}
            className="rounded-md text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft size={22} aria-hidden />
          </button>
        )}
        <div className="flex flex-1 gap-1.5">
          <div className="h-1 flex-1 rounded-full bg-primary" />
          <div className={cn("h-1 flex-1 rounded-full", step === 2 ? "bg-primary" : "bg-border")} />
        </div>
      </div>

      {step === 1 ? (
        <div className="flex flex-1 flex-col">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            {t("onboarding.pseudoStep")}
          </p>
          <h1 className="mt-2 font-display text-[28px] font-bold text-foreground">
            {t("onboarding.pseudoTitle")}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            {t("onboarding.pseudoSubtitle")}
          </p>

          <div className="relative mt-8">
            <input
              value={pseudo}
              onChange={(event) => setPseudo(event.target.value)}
              placeholder={t("onboarding.pseudoPlaceholder")}
              autoFocus
              autoComplete="off"
              aria-invalid={availability.status === "error"}
              className="h-[54px] w-full rounded-xl border border-border bg-card pl-4 pr-11 text-base text-foreground outline-none transition-colors placeholder:text-text-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
            />
            {availability.status === "ok" && (
              <Check
                size={20}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-success"
                aria-hidden
              />
            )}
          </div>

          <p
            aria-live="polite"
            className={cn(
              "mt-2.5 min-h-[18px] text-xs",
              availability.status === "ok" ? "text-success" : "text-destructive",
            )}
          >
            {availability.status === "checking" && t("onboarding.pseudoChecking")}
            {availability.status === "ok" && t("onboarding.pseudoAvailable")}
            {availability.status === "error" && t(ERROR_KEY[availability.error])}
          </p>

          <div className="flex-1" />
          <Button size="block" disabled={!canContinue} onClick={() => setStep(2)}>
            {t("common.next")}
          </Button>
        </div>
      ) : (
        <form action={formAction} className="flex flex-1 flex-col">
          <input type="hidden" name="pseudo" value={pseudo} />
          <input type="hidden" name="avatar_key" value={avatar ?? ""} />

          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            {t("onboarding.avatarStep")}
          </p>
          <h1 className="mt-2 font-display text-[28px] font-bold text-foreground">
            {t("onboarding.avatarTitle")}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            {t("onboarding.avatarSubtitle")}
          </p>

          <div className="mt-7">
            <HelmetPicker value={avatar} onChange={setAvatar} />
          </div>

          {/* 'taken' est surfacé à l'étape 1 (cf. effet ci-dessus) — on ne le réaffiche
              pas ici, sinon le message persiste sous le casque après le rebond. */}
          {state.error && state.error !== "taken" && (
            <p aria-live="polite" className="mt-4 text-xs text-destructive">
              {t(ERROR_KEY[state.error])}
            </p>
          )}

          <div className="flex-1" />
          <Button type="submit" size="block" disabled={!avatar || isSubmitting}>
            {isSubmitting ? t("common.loading") : t("onboarding.finish")}
          </Button>
        </form>
      )}
    </main>
  );
}
