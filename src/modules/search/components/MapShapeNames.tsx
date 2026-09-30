import { useMemo } from "react";
import { Marker } from "react-map-gl/maplibre";

import { pickLabelledFeatures, type GeoShapeLayer } from "@/lib/geoShapes";
import { GEO_SHAPE_MAX_LABELS } from "@/types/geo-shape-schema";

interface MapShapeNamesProps {
  layers: GeoShapeLayer[];
}

interface PlacedName {
  key: string;
  name: string;
  longitude: number;
  latitude: number;
}

/**
 * Nom de chaque contour, posé SUR le contour (couches déclarées `showNames`).
 *
 * Overlays HTML plutôt qu'un calque `symbol` MapLibre : le style de repli (sans clé MapTiler)
 * n'embarque aucun glyphe, un calque de texte y serait donc muet. En HTML, le libellé suit en plus
 * les jetons du thème comme le reste de l'interface.
 *
 * Le placement est calculé une fois par jeu de contours : c'est une recherche par grille, pas une
 * moyenne — voir `polygonLabelPoint`.
 */
export default function MapShapeNames({ layers }: MapShapeNamesProps) {
  const names = useMemo<PlacedName[]>(() => {
    const placed: PlacedName[] = [];
    for (const layer of layers) {
      if (!layer.showNames) continue;
      // Sélection PARTAGÉE avec le rendu SVG (`projectShapes`) : au-delà du plafond, les plus
      // VASTES sont nommés — ce sont ceux dont le libellé tient.
      for (const { feature, name, point } of pickLabelledFeatures(layer.data.features, GEO_SHAPE_MAX_LABELS)) {
        placed.push({
          key: `${layer.id}-${feature.id ?? point.join(",")}`,
          name,
          longitude: point[0],
          latitude: point[1],
        });
      }
    }
    return placed;
  }, [layers]);

  return (
    <>
      {names.map((placed) => (
        <Marker key={placed.key} longitude={placed.longitude} latitude={placed.latitude} style={{ pointerEvents: "none" }}>
          <span className="whitespace-nowrap rounded-full bg-card/80 px-2 py-0.5 text-[11px] font-medium leading-tight text-foreground shadow-sm ring-1 ring-border/50 backdrop-blur-[2px]">
            {placed.name}
          </span>
        </Marker>
      ))}
    </>
  );
}
