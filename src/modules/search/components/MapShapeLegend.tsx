import { ShapeLegend } from "@/components/shared/ShapeLegend";
import type { GeoShapeLayer } from "@/lib/geoShapes";

interface MapShapeLegendProps {
  layers: GeoShapeLayer[];
}

/**
 * Légende des couches de contours, en surimpression de la carte. Le choix des couches légendées et
 * leur pastille viennent de `ShapeLegend`, partagé avec la section `map-shapes`.
 */
export default function MapShapeLegend({ layers }: MapShapeLegendProps) {
  return (
    <ShapeLegend
      layers={layers}
      className="pointer-events-none absolute bottom-4 left-2 z-20 flex flex-col gap-1.5 rounded-lg border border-border/60 bg-card/90 px-3 py-2 shadow-md backdrop-blur-sm"
      itemClassName="text-foreground"
    />
  );
}
