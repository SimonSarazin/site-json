import { useState } from "react";
import { toast } from "sonner";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { getSiteCostumContext } from "@/lib/siteCostum";
import { downloadBlob } from "@/lib/downloadBlob";

const COSTUM_TYPES = new Set(["organizations", "projects", "events", "citoyens"]);
type CostumType = "organizations" | "projects" | "events" | "citoyens";

/**
 * Édition PDF imprimable de l'agenda (`AGENDA_GET_PDF`, SDK ≥ 1.0.196) : scope le costum PORTEUR
 * entier (son id/type, pas un événement) — jamais la liste filtrée affichée à l'écran. Réponse
 * binaire (`ArrayBuffer`, cf. JSDoc de la méthode) : empaquetée en `Blob` et téléchargée via
 * `downloadBlob` (mécanique partagée avec `downloadCsv.ts` — seul le `Blob` construit en amont diffère).
 */
export function useAgendaPdfExport() {
  const { api, contextId, contextType } = useCocolight();
  const t = useT("modules/agenda");
  const [isExporting, setIsExporting] = useState(false);

  const costum = getSiteCostumContext({ contextId, contextType });
  const type = costum?.costumType;
  // `useCocolight().contextType` est une chaîne non resserrée (réseau) — l'enum strict du SDK
  // (`AgendaGetPdfData.type`) doit être revérifié ici, pas seulement supposé.
  const canExport = !!api && !!costum?.costumId && typeof type === "string" && COSTUM_TYPES.has(type);

  const exportPdf = async () => {
    if (!api || !costum?.costumId || !type || !COSTUM_TYPES.has(type)) return;
    setIsExporting(true);
    try {
      const data = await api.endpointApi.agendaGetPdf({
        id: costum.costumId,
        type: type as CostumType,
        costum_slug: costum.costumSlug,
      });
      downloadBlob(new Blob([data as ArrayBuffer], { type: "application/pdf" }), `agenda-${costum.costumSlug}.pdf`);
    } catch {
      toast.error(t("pdfExport.error"));
    } finally {
      setIsExporting(false);
    }
  };

  return { exportPdf, isExporting, canExport };
}
