import { DynamicIcon, type IconName } from "lucide-react/dynamic";

/** Même gabarit que `MapMarkerPin` : les deux variantes cohabitent sur la même
 *  carte (`by`), elles doivent peser pareil. */
const SIZE = 34;
/** Le disque fait 12/24 × 34 ≈ 17 px : un glyphe de 13 px y tient avec du bord. */
const GLYPH = 13;

/**
 * Variant marqueur « goutte + pictogramme lucide » (`map.marker.icon`) — la
 * pastille du pin nu est remplacée par un disque `borderColor` portant le
 * glyphe, peint dans la couleur de la goutte (`color`).
 *
 * À la DIFFÉRENCE de `iconUrl` (image brandée servie par le backend, hors
 * thème), tout est ici en jetons CSS : le marqueur suit light/dark au paint et
 * n'exige aucun asset. Nom hors catalogue lucide → `DynamicIcon` rend `null` :
 * la goutte reste, sans glyphe (l'audit `icone-inconnue` attrape le cas avant).
 */
export default function MapMarkerPinIcon({
  icon,
  cssColor,
  borderCssColor = "var(--background)",
}: {
  icon: string;
  cssColor: string;
  borderCssColor?: string;
}) {
  return (
    <span className="search-map-pin-icon" style={{ width: SIZE, height: SIZE }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={SIZE}
        height={SIZE}
        className="search-map-pin"
        aria-hidden
      >
        <path
          d="M12 1C7.6 1 4 4.6 4 9c0 5.8 8 14 8 14s8-8.2 8-14c0-4.4-3.6-8-8-8Z"
          fill={cssColor}
          stroke={borderCssColor}
          strokeWidth={1.2}
        />
        <circle cx={12} cy={9} r={6} fill={borderCssColor} />
      </svg>
      <DynamicIcon
        name={icon as IconName}
        size={GLYPH}
        color={cssColor}
        strokeWidth={2.5}
        className="search-map-glyph"
        aria-hidden
      />
    </span>
  );
}
