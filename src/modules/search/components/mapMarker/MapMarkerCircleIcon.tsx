import { DynamicIcon, type IconName } from "lucide-react/dynamic";

/** Part du diamètre occupée par le glyphe : 15 px sur les 30 px historiques de
 *  `.search-map-circle` (le reste est le bord de 2 × 3 px). Ratio conservé à
 *  toutes les tailles pour que `iconSize` agrandisse la pastille ET son pictogramme. */
const GLYPH_RATIO = 0.5;

/**
 * Variant marqueur « pastille + pictogramme lucide » (`map.marker.icon` avec
 * `style: "circle"`) — pendant rond de {@link MapMarkerPinIcon} : fond en
 * couleur de thème (`color`), glyphe peint en `borderColor` (déf.
 * `--background`) pour rester lisible sur le fond plein.
 */
export default function MapMarkerCircleIcon({
  icon,
  cssColor,
  borderCssColor = "var(--background)",
  size,
}: {
  icon: string;
  cssColor: string;
  borderCssColor?: string;
  size: number;
}) {
  return (
    <span
      className="search-map-circle search-map-circle-icon"
      style={{ background: cssColor, borderColor: borderCssColor, width: size, height: size }}
    >
      <DynamicIcon
        name={icon as IconName}
        size={Math.round(size * GLYPH_RATIO)}
        color={borderCssColor}
        strokeWidth={2.5}
        aria-hidden
      />
    </span>
  );
}
