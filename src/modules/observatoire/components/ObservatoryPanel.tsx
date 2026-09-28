import "../i18n";
import { useMemo } from "react";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import type { ObservatoryPanelConf } from "../dashboardSchema";
import { buildLabelMaps } from "../dimensions";
import { toItems } from "../hooks/useObservatoryItemsQuery";
import { KpiCards } from "./KpiCards";
import { ObservatoryCharts } from "./Charts";

/**
 * Le tableau de bord SANS sa page : KPI en bandeau puis graphes, calculés sur
 * des résultats que l'APPELANT a déjà chargés.
 *
 * C'est ce qui le rend réutilisable. `DataObservatorySection` possède ses
 * données (requête, filtres, progression, table, liste latérale) ; ici il n'y
 * a ni requête ni état — la section hôte passe ses résultats courants et les
 * chiffres suivent d'eux-mêmes sa recherche et ses filtres, exactement comme
 * la carte suit les mêmes résultats. Deux sources de vérité donneraient deux
 * totaux différents sur le même écran.
 *
 * `part` découpe le rendu, car les deux blocs ne vont pas toujours au même
 * endroit : en deux colonnes, les KPI se lisent en BANDEAU pleine largeur
 * au-dessus (une colonne étroite les tasse sur plusieurs lignes) et les
 * graphes occupent la colonne de droite. L'hôte monte alors le panneau deux
 * fois ; le recalcul est négligeable (une projection des résultats, et
 * `buildLabelMaps` ne travaille que pour les dimensions à `keyPaths`), et
 * c'est le prix d'un agencement décidé par l'hôte — le même arbitrage que
 * `DataObservatorySection`, qui compose aussi ses blocs séparément.
 *
 * Monté en `lazy()` par ses hôtes : il tire recharts, qui pèse.
 */
export default function ObservatoryPanel({
  results,
  conf,
  animate = true,
  part = "all",
}: {
  /** Résultats de la section hôte — convention `serverData` appliquée ici. */
  results: readonly SearchEntity[];
  conf: ObservatoryPanelConf;
  /** Animer l'apparition (false tant que le chargement continue). */
  animate?: boolean;
  /** Bloc rendu : tout (défaut), les KPI seuls, ou les graphes seuls. */
  part?: "all" | "kpis" | "charts";
}) {
  useLoadNamespace("modules/observatoire");
  const t = useT("modules/observatoire");

  const items = useMemo(() => toItems(results).items, [results]);
  const dimensions = conf.dimensions;
  // Libellés canoniques des dimensions à `keyPaths`, dérivés du jeu COURANT :
  // l'hôte n'a pas de « dataset complet » séparé à nous donner.
  const labels = useMemo(() => buildLabelMaps(items, dimensions), [items, dimensions]);

  const kpis = part === "charts" ? [] : (conf.kpis ?? []);
  const charts = part === "kpis" ? [] : (conf.charts ?? []);

  if (items.length === 0) {
    // Un seul message, porté par les graphes : monté deux fois, le panneau le
    // répéterait au-dessus et au-dessous du même écran.
    if (part === "kpis") return null;
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {t("emptyFiltered")}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {kpis.length > 0 && (
        <KpiCards
          data={items}
          dimensions={dimensions}
          kpis={kpis}
          labels={labels}
          layout={conf.kpiLayout}
        />
      )}
      {charts.length > 0 && (
        <ObservatoryCharts
          charts={charts}
          data={items}
          dimensions={dimensions}
          labels={labels}
          animate={animate}
        />
      )}
    </div>
  );
}
