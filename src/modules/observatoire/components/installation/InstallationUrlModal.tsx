import { Suspense } from "react";
import { lazy } from "vite-preload";
import { useSearchParams } from "react-router";
import { DEFAULT_INSTALLATION_PARAM, type ListConf } from "@/modules/search/schema";

const InstallationDashboardModal = lazy(() => import("./InstallationDashboardModal"));

interface InstallationUrlModalProps {
  /** Bloc `preview` de la section — porte `installationDashboard` + `reservations`. */
  preview: NonNullable<ListConf["preview"]>;
}

/**
 * Ouvre la fiche installation depuis l'URL seule (`?installation=<groupKey>`) —
 * c'est ce qui rend le bouton Partager de la modal opérant : le destinataire
 * arrive sur la page et ne voit QUE cette fiche, sans fiche équipement derrière.
 *
 * Monté par les sections qui déclarent le preview (searchProStatic,
 * data-observatory). Le clic sur `inst_nom` depuis une fiche équipement, lui,
 * garde son état local dans `PreviewPoiAmenities` (il fonctionne aussi hors de
 * ces sections, ex. command palette).
 */
export default function InstallationUrlModal({ preview }: InstallationUrlModalProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const conf = preview.installationDashboard;
  const reservations = preview.reservations;
  const param = conf?.param ?? DEFAULT_INSTALLATION_PARAM;
  const instValue = searchParams.get(param)?.trim() ?? "";

  if (!conf || !reservations || !instValue) return null;

  // Fermeture = retrait du param : l'URL reste la source de vérité (back/forward
  // ferment et rouvrent la fiche sans état local à resynchroniser).
  const close = () =>
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete(param);
        return params;
      },
      { replace: true, preventScrollReset: true },
    );

  return (
    <Suspense fallback={null}>
      <InstallationDashboardModal
        open
        onOpenChange={(next) => {
          if (!next) close();
        }}
        instValue={instValue}
        reservations={reservations}
        conf={conf}
      />
    </Suspense>
  );
}
