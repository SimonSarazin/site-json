/**
 * Variant marqueur « pastille ronde » (`map.marker.style: "circle"`) — fond en
 * couleur de thème (`color`), anneau en `borderColor` (déf. `--background`).
 * Les deux suivent light/dark (jetons CSS au paint). Cf. `.search-map-circle`.
 * `size` (px) vient de `map.marker.iconSize` et prime sur la classe.
 */
export default function MapMarkerCircle({
  cssColor,
  borderCssColor = "var(--background)",
  size,
}: {
  cssColor: string;
  borderCssColor?: string;
  size: number;
}) {
  return (
    <span
      className="search-map-circle"
      style={{ background: cssColor, borderColor: borderCssColor, width: size, height: size }}
    />
  );
}
