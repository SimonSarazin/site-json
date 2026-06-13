// Surcouche de progression de la VUE CARTE (chargement progressif par pages —
// cf. useSearchAllResults) : barre + compteur pendant l'enchaînement des
// pages, alerte discrète si le plafond maxResults a tronqué le périmètre.
// Pattern repris du dashboard observatoire (total connu dès la 1ʳᵉ page).
import { TriangleAlert } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useT } from "@/hooks/useT";

interface MapProgressProps {
  loaded: number;
  total: number | null;
  /** Vrai quand tout est chargé (ou plafonné). */
  isComplete: boolean;
  /** Vrai si l'arrêt vient du plafond maxResults. */
  capped: boolean;
}

export default function MapProgress({ loaded, total, isComplete, capped }: MapProgressProps) {
  const t = useT("modules/search");

  // 1000 : au-dessus des panes Leaflet (tuiles/markers < 700, contrôles 1000).
  if (!isComplete && total !== null && loaded > 0) {
    return (
      <div className="absolute left-1/2 top-2 z-[1000] w-64 -translate-x-1/2 space-y-1 rounded-md border border-border bg-background/90 px-3 py-2 shadow-sm backdrop-blur-sm">
        <Progress value={Math.round((loaded / Math.max(total, 1)) * 100)} className="h-1.5" />
        <p className="text-center text-xs text-muted-foreground tabular-nums">
          {t("Chargement des points… {{loaded}} / {{total}}", undefined, { loaded, total })}
        </p>
      </div>
    );
  }

  if (capped) {
    return (
      <div className="absolute left-1/2 top-2 z-[1000] flex -translate-x-1/2 items-center gap-1.5 rounded-md border border-border bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
        <TriangleAlert className="h-3.5 w-3.5 text-amber-500" />
        {t("Carte limitée aux {{loaded}} premiers résultats", undefined, { loaded })}
      </div>
    );
  }

  return null;
}
