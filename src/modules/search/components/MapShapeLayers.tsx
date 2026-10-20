import { useMemo } from "react";
import { useTheme } from "next-themes";
import { Layer, Source } from "react-map-gl/maplibre";

import { resolveThemeColor, type GeoShapeLayer } from "@/lib/geoShapes";

/** Repli si le jeton n'existe pas dans le thème du site (bleu neutre, lisible clair ET sombre). */
const FALLBACK_COLOR = "#2563eb";

interface MapShapeLayersProps {
  layers: GeoShapeLayer[];
}

/**
 * Peint les couches de contours déclarées par `map.shapes` : un `<Source>` GeoJSON par couche,
 * un remplissage (sauf `fill: "none"`) et un trait.
 *
 * Rendu SOUS les marqueurs sans effort : les marqueurs sont des overlays HTML, ces couches sont
 * dans le canvas WebGL.
 */
export default function MapShapeLayers({ layers }: MapShapeLayersProps) {
  const { resolvedTheme } = useTheme();

  // Les jetons sont lus dans les variables CSS du document : leur valeur DÉPEND du mode courant,
  // d'où `resolvedTheme` en dépendance. Lecture en `useMemo` et non en effet : next-themes pose
  // la classe sur `<html>` AVANT le render déclenché par le changement de `resolvedTheme`.
  const palette = useMemo(
    () =>
      new Map(
        layers.map((layer) => [
          layer.id,
          {
            fill: layer.style?.fill === "none" ? null : resolveThemeColor(layer.style?.fill ?? "primary", FALLBACK_COLOR),
            stroke: resolveThemeColor(layer.style?.stroke ?? layer.style?.fill ?? "primary", FALLBACK_COLOR),
          },
        ]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layers, resolvedTheme],
  );

  return (
    <>
      {layers.map((layer) => {
        if (layer.data.features.length === 0) return null;
        const colors = palette.get(layer.id);
        if (!colors) return null;
        return (
          <Source key={layer.id} id={`shapes-${layer.id}`} type="geojson" data={layer.data}>
            {colors.fill && (
              <Layer
                id={`shapes-${layer.id}-fill`}
                type="fill"
                paint={{ "fill-color": colors.fill, "fill-opacity": layer.style?.fillOpacity ?? 0.12 }}
              />
            )}
            <Layer
              id={`shapes-${layer.id}-line`}
              type="line"
              paint={{
                "line-color": colors.stroke,
                "line-width": layer.style?.strokeWidth ?? 1.5,
                "line-opacity": layer.style?.strokeOpacity ?? 0.9,
              }}
            />
          </Source>
        );
      })}
    </>
  );
}
