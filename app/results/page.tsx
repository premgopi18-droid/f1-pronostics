import { t } from "@/lib/i18n";
import { TabPlaceholder } from "@/app/components/tab-placeholder";

// Onglet « GP Résultats » — calendrier + résultats officiels (à construire : #49).
export default function ResultatsPage() {
  return <TabPlaceholder title={t("nav.results")} />;
}
