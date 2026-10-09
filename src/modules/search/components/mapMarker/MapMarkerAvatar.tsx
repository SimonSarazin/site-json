import { useState } from "react";
import { User } from "lucide-react";

/**
 * Variant marqueur « vignette ronde de l'item » (`map.marker.useItemImage`) —
 * image de l'item en cercle (cf. `.search-map-avatar`). `size` (px) vient de
 * `map.marker.iconSize` et prime sur les dimensions de la classe.
 *
 * Repli sur une silhouette si l'image ÉCHOUE à charger : la chaîne de
 * `resolveMarkerVisual` ne se replie sur le pin qu'en l'ABSENCE du champ, pas
 * quand l'URL est présente mais morte (avatar supprimé, chemin obsolète). Sans
 * ce garde, le marqueur rend l'icône « image cassée » du navigateur — l'item
 * disparaît visuellement de la carte sans le moindre signal.
 */
export default function MapMarkerAvatar({ src, size }: { src: string; size: number }) {
  // On mémorise l'URL qui a échoué, pas un booléen : `src` peut changer sans
  // démontage (marqueurs mémoïsés puis réconciliés), et comparer à `src` remet
  // l'état à neuf tout seul — sans effet de reset, qu'une URL morte
  // condamnerait sinon la suivante.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;

  if (failed) {
    return (
      <span className="search-map-avatar is-fallback" style={{ width: size, height: size }}>
        <User style={{ width: size * 0.55, height: size * 0.55 }} />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailedSrc(src)}
      className="search-map-avatar"
      style={{ width: size, height: size }}
    />
  );
}
