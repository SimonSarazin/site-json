import { useLocalization } from "@/hooks/useLocalization";
import { cssColorToken, type GeoShapeLayer } from "@/lib/geoShapes";
import { cn } from "@/lib/utils";
import type { GeoShapeStyle } from "@/types/geo-shape-schema";
import type { LocalizedString } from "@/types/locale-schema";

type LabelledLayer = GeoShapeLayer & { label: LocalizedString };

interface ShapeLegendProps {
  layers: GeoShapeLayer[];
  /** Disposition de la liste : c'est tout ce qui distingue une vue de l'autre. */
  className?: string;
  itemClassName?: string;
}

/**
 * Pastille peinte comme le contour, remplissage renforcé : à l'opacité par défaut d'un contour
 * (0,12), un carré de 12 px serait invisible.
 */
function swatchStyle(style: GeoShapeStyle | undefined): React.CSSProperties {
  return {
    backgroundColor: cssColorToken(style?.fill, "transparent"),
    opacity: style?.fill === "none" ? 1 : (style?.fillOpacity ?? 0.12) + 0.35,
    borderColor: cssColorToken(style?.stroke ?? style?.fill, "var(--border)"),
  };
}

/**
 * Légende des couches de contours, commune à la carte (`MapShapeLegend`) et à la section SVG
 * (`MapShapes`) : une couche doit se reconnaître d'une vue à l'autre.
 *
 * N'y entrent que les couches qui portent un `label` en config ET ont des contours à montrer. Sans
 * libellé, la couche reste du décor ; libellée mais vide, sa case enverrait chercher ce qui n'existe
 * pas. Aucune couche légendée : rien n'est rendu, pas même le conteneur.
 */
export function ShapeLegend({ layers, className, itemClassName }: ShapeLegendProps) {
  const { t } = useLocalization();
  const labelled = layers.filter(
    (layer): layer is LabelledLayer => Boolean(layer.label) && layer.data.features.length > 0,
  );
  if (labelled.length === 0) return null;

  return (
    <ul className={className}>
      {labelled.map((layer) => (
        <li key={layer.id} className={cn("flex items-center gap-2 text-xs", itemClassName)}>
          <span aria-hidden className="h-3 w-3 shrink-0 rounded-[3px] border" style={swatchStyle(layer.style)} />
          {t(layer.label)}
        </li>
      ))}
    </ul>
  );
}
