import { useLocalization } from "@/hooks/useLocalization";
import { cssColorToken, type GeoShapeLayer } from "@/lib/geoShapes";

interface MapShapeLegendProps {
  layers: GeoShapeLayer[];
}

/**
 * Légende des couches de contours — n'affiche QUE les couches qui portent un `label` en config et
 * ont des contours à montrer. Sans libellé, la couche reste du décor et la légende ne s'affiche
 * pas du tout : c'est ce qui rend `label` facultatif sans laisser de clé morte.
 */
export default function MapShapeLegend({ layers }: MapShapeLegendProps) {
  const { t } = useLocalization();
  const labelled = layers.filter((layer) => layer.label && layer.data.features.length > 0);
  if (labelled.length === 0) return null;

  return (
    <div className="pointer-events-none absolute bottom-4 left-2 z-20 rounded-lg border border-border/60 bg-card/90 px-3 py-2 shadow-md backdrop-blur-sm">
      <ul className="flex flex-col gap-1.5">
        {labelled.map((layer) => (
          <li key={layer.id} className="flex items-center gap-2 text-xs text-foreground">
            <span
              aria-hidden
              className="h-3 w-3 shrink-0 rounded-[3px] border"
              style={{
                backgroundColor: cssColorToken(layer.style?.fill, "transparent"),
                opacity: layer.style?.fill === "none" ? 1 : (layer.style?.fillOpacity ?? 0.12) + 0.35,
                borderColor: cssColorToken(layer.style?.stroke ?? layer.style?.fill, "var(--border)"),
              }}
            />
            {t(layer.label!)}
          </li>
        ))}
      </ul>
    </div>
  );
}
