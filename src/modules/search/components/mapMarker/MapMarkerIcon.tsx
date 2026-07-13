/**
 * Variant marqueur « icône custom » (`map.marker.iconUrl`) — image/SVG brandée
 * par site/section. Taille en px (cf. resolveMarkerVisual ← `iconSize`).
 */
export default function MapMarkerIcon({ src, size }: { src: string; size: number }) {
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className="search-map-icon"
      style={{ width: size, height: size }}
    />
  );
}
