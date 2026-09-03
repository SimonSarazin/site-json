import { DynamicIcon, type IconName } from "lucide-react/dynamic";

/** Diamètre intérieur de `.search-map-circle` : 30 px − 2 × 3 px de bord = 24 px. */
const GLYPH = 15;

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
}: {
  icon: string;
  cssColor: string;
  borderCssColor?: string;
}) {
  return (
    <span
      className="search-map-circle search-map-circle-icon"
      style={{ background: cssColor, borderColor: borderCssColor }}
    >
      <DynamicIcon
        name={icon as IconName}
        size={GLYPH}
        color={borderCssColor}
        strokeWidth={2.5}
        aria-hidden
      />
    </span>
  );
}
