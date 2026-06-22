import { t } from "@/lib/i18n";

/**
 * Page d'atterrissage temporaire d'un onglet pas encore construit.
 * Remplacée par le vrai écran à son ticket (#47 Ligues, #45/#46 Pronos, #49 Résultats).
 */
export function TabPlaceholder({ title }: { title: string }) {
  return (
    <main className="flex flex-1 flex-col px-[18px] pt-2">
      <h1 className="py-2 font-display text-2xl font-bold text-foreground">{title}</h1>
      <p className="text-sm text-text-secondary">{t("common.comingSoon")}</p>
    </main>
  );
}
