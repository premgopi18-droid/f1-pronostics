import { headers } from "next/headers";
import { OnboardingWizard } from "./onboarding-wizard";

// Accès contrôlé par le proxy : seuls les comptes non finalisés (onboarding_completed
// = false) atteignent cette page ; les autres sont redirigés vers la Home.
export default async function OnboardingPage() {
  const userId = (await headers()).get("x-user-id")!;
  return <OnboardingWizard userId={userId} />;
}
