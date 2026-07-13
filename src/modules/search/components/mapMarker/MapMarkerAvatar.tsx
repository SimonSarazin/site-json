/**
 * Variant marqueur « vignette ronde de l'item » (`map.marker.useItemImage`) —
 * image de l'item en cercle (cf. `.search-map-avatar`).
 */
export default function MapMarkerAvatar({ src }: { src: string }) {
  return <img src={src} alt="" loading="lazy" className="search-map-avatar" />;
}
