/**
 * Variant marqueur « pastille ronde » (`map.marker.style: "circle"`) — fond en
 * couleur de thème (`color`), anneau en `borderColor` (déf. `--background`).
 * Les deux suivent light/dark (jetons CSS au paint). Cf. `.search-map-circle`.
 */
export default function MapMarkerCircle({
  cssColor,
  borderCssColor = "var(--background)",
}: {
  cssColor: string;
  borderCssColor?: string;
}) {
  console.log("MapMarkerCircle render", cssColor, borderCssColor); // eslint-disable-line no-console
  return (
    <span className="search-map-circle" style={{ background: cssColor, borderColor: borderCssColor }} />
  );
}
