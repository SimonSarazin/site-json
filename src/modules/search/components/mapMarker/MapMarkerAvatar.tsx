/**
 * Variant marqueur « vignette ronde de l'item » (`map.marker.useItemImage`) —
 * image de l'item en cercle (cf. `.search-map-avatar`). `size` (px) vient de
 * `map.marker.iconSize` et prime sur les dimensions de la classe.
 */
export default function MapMarkerAvatar({ src, size }: { src: string; size: number }) {
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className="search-map-avatar"
      style={{ width: size, height: size }}
    />
  );
}
