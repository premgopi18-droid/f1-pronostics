import { t } from "@/lib/i18n";
import { TabPlaceholder } from "@/app/components/tab-placeholder";

// Onglet « Mes Pronos » — agrégat des pronostics (à construire : #45 / #46).
export default function MesPronosPage() {
  return <TabPlaceholder title={t("nav.predictions")} />;
}
