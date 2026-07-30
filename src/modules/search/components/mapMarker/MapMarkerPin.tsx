/**
 * Variant marqueur « goutte » (pin) — `map.marker.style: "pin"` ou défaut.
 * fill = couleur de thème (`color`) ; contour + pastille = `borderColor`
 * (déf. `--background`, lisible sur tout fond de carte en light comme en dark).
 * Rendu en React (les couleurs suivent light/dark au paint, sans recalcul).
 */
export default function MapMarkerPin({
  cssColor,
  borderCssColor = "var(--background)",
}: {
  cssColor: string;
  borderCssColor?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={34}
      height={34}
      className="search-map-pin"
      aria-hidden
    >
      <path
        d="M12 1C7.6 1 4 4.6 4 9c0 5.8 8 14 8 14s8-8.2 8-14c0-4.4-3.6-8-8-8Z"
        fill={cssColor}
        stroke={borderCssColor}
        strokeWidth={1.2}
      />
      <circle cx={12} cy={9} r={3} fill={borderCssColor} />
    </svg>
  );
}
