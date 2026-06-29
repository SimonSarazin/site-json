// ------------------------------------------------------------
// SearchMapMarkers.tsx — marqueurs HTML de la carte (react-map-gl/maplibre)
// ------------------------------------------------------------
// Remplace les `divIcon` Leaflet : ici chaque marqueur est un vrai <Marker>
// react-map-gl rendant du JSX → les couleurs de thème (`var(--primary)`…)
// suivent light/dark au paint, sans recalcul. Mémoïsés (#4) : le set de
// marqueurs affichés change à chaque pan/zoom (clustering), mais un marqueur
// donné ne re-render pas tant que ses props (entry/coords/callbacks STABLES)
// ne changent pas.

import { memo, useMemo } from "react";
import { Marker } from "react-map-gl/maplibre";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { resolveMarkerVisual, type MarkerVisual } from "../lib/markerVisual";
import type { MapConf } from "../schema";
import MapMarkerAvatar from "./mapMarker/MapMarkerAvatar";
import MapMarkerIcon from "./mapMarker/MapMarkerIcon";
import MapMarkerCircle from "./mapMarker/MapMarkerCircle";
import MapMarkerPin from "./mapMarker/MapMarkerPin";

/**
 * Dispatcher des VUES de marqueur point, sur le même modèle que `SearchCard` :
 * le variant est choisi par le `kind` résolu (cf. `resolveMarkerVisual` ← config
 * `map.marker`). Chaque variant vit dans `./mapMarker/MapMarker<X>.tsx`.
 *
 * NB perf : à la DIFFÉRENCE des cards, les variants ne sont PAS en `lazy()` — un
 * marqueur est rendu par point (des centaines) ; un Suspense par marqueur serait
 * coûteux et les variants sont minuscules → import statique.
 *
 * Pour ajouter une vue : créer `./mapMarker/MapMarker<X>.tsx` (export default),
 * l'importer ci-dessus, ajouter le `case` (+ le `kind` dans markerVisual.ts).
 */
function MarkerVisualView({ visual }: { visual: MarkerVisual }) {
  console.log("MarkerVisualView render", visual); // eslint-disable-line no-console
  switch (visual.kind) {
    case "image":
      return <MapMarkerAvatar src={visual.src} />;
    case "icon":
      return <MapMarkerIcon src={visual.src} size={visual.size} />;
    case "circle":
      return <MapMarkerCircle cssColor={visual.cssColor} borderCssColor={visual.borderCssColor} />;
    case "pin":
      return <MapMarkerPin cssColor={visual.cssColor} borderCssColor={visual.borderCssColor} />;
    default:
      return <MapMarkerPin cssColor="var(--primary)" />;
  }
}

export interface PointMarkerProps {
  longitude: number;
  latitude: number;
  entry: SearchEntity;
  markerConf: MapConf["marker"];
  baseUrl: string;
  /** Stable (useCallback côté parent) → préserve la mémoïsation. */
  onSelect: (entry: SearchEntity) => void;
}

export const PointMarker = memo(function PointMarker({
  longitude,
  latitude,
  entry,
  markerConf,
  baseUrl,
  onSelect,
}: PointMarkerProps) {
  // Apparence (vignette / icône custom / pin / pastille / défaut) — chaîne de repli pure, cf. markerVisual.ts.
  const visual = useMemo(
    () => resolveMarkerVisual(entry.serverData as Record<string, unknown>, markerConf, baseUrl),
    [entry, markerConf, baseUrl],
  );
  // Vignette/pastille rondes : centrées sur le point ; goutte (pin) : la pointe
  // est sur le point ; icône custom : ancrage déclaré (déf. bottom).
  const anchor =
    visual.kind === "image" || visual.kind === "circle"
      ? "center"
      : visual.kind === "icon"
        ? visual.anchor
        : "bottom";
  const name = (entry.serverData as { name?: unknown } | undefined)?.name;
  return (
    <Marker
      longitude={longitude}
      latitude={latitude}
      anchor={anchor}
      onClick={(e) => {
        // Empêche le clic d'atteindre la carte (dont le onClick ferme la popup).
        e.originalEvent.stopPropagation();
        onSelect(entry);
      }}
    >
      <button type="button" className="search-map-marker-btn" aria-label={typeof name === "string" ? name : undefined}>
        <MarkerVisualView visual={visual} />
      </button>
    </Marker>
  );
});

export interface ClusterMarkerProps {
  longitude: number;
  latitude: number;
  clusterId: number;
  pointCount: number;
  totalPoints: number;
  /** Stable (useCallback côté parent) → préserve la mémoïsation. */
  onExpand: (clusterId: number, longitude: number, latitude: number) => void;
}

export const ClusterMarker = memo(function ClusterMarker({
  longitude,
  latitude,
  clusterId,
  pointCount,
  totalPoints,
  onExpand,
}: ClusterMarkerProps) {
  // Diamètre ∝ part du cluster dans le total (clamp 40→68 px).
  const size = 40 + Math.min(pointCount / Math.max(totalPoints, 1), 1) * 28;
  return (
    <Marker
      longitude={longitude}
      latitude={latitude}
      anchor="center"
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onExpand(clusterId, longitude, latitude);
      }}
    >
      <button
        type="button"
        className="search-map-cluster"
        style={{ width: size, height: size }}
        aria-label={`${pointCount}`}
      >
        {pointCount}
      </button>
    </Marker>
  );
});
