import "maplibre-gl/dist/maplibre-gl.css";
import "@maptiler/sdk/dist/maptiler-sdk.css";

import { useTheme } from "next-themes";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import Map, { NavigationControl, Popup, type MapLib, type MapProps, type MapRef } from "react-map-gl/maplibre";
import * as maptilersdk from "@maptiler/sdk";
import Supercluster from "supercluster";

import { useT } from "@/hooks/useT";
import { useSite } from "@/hooks/useSite";
import { getBaseUrl, getMaptilerApiKey } from "@/lib/constant/common";
import type { SearchEntity } from "@communecter/cocolight-api-client";

import { SearchMapProps } from "../schema";
import { resolveMapStyles } from "../lib/mapStyles";
import { useMapContainerClass } from "../hooks/useMapContainerClass";
import { SwitchDetailsMode } from "./SwitchDetailsMode";
import SearchMapPopup from "./SearchMapPopup";
import { ClusterMarker, PointMarker } from "./SearchMapMarkers";

// Clé MapTiler résolue UNE fois au chargement du chunk (client-only — ce module
// n'est importé que via SearchMapWrapper/useClientModule). Avec clé, on délègue
// le rendu à `@maptiler/sdk` (mapLib du <Map>) qui expanse les IDs de style.
const MAPTILER_KEY = getMaptilerApiKey();
if (MAPTILER_KEY) {
  maptilersdk.config.apiKey = MAPTILER_KEY;
}

// @maptiler/sdk ajoute par défaut SES propres contrôles (navigation + géoloc),
// ce qui DOUBLE le <NavigationControl> qu'on rend nous-mêmes. On les désactive
// pour ne garder qu'UN bloc de zoom (le nôtre, identique en mode MapTiler et en
// repli raster). react-map-gl spread tous les props dans `new Map(options)` →
// ces options atteignent le constructeur du SDK ; elles ne font pas partie de
// MapProps (typage MapLibre standard), d'où le cast. Le logo MapTiler reste
// (attribution requise). Sans clé (repli MapLibre), ces clés sont ignorées.
const SDK_CONTROL_PROPS = {
  navigationControl: false,
  geolocateControl: false,
} as unknown as Partial<MapProps>;

/** Props d'un point supercluster : on transporte l'entité dans le feature. */
type PointProps = { entry: SearchEntity };

function isValidGeoPoint(coords: unknown): coords is [number, number] {
  if (!Array.isArray(coords) || coords.length !== 2) return false;
  const [lng, lat] = coords;
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Carte MapLibre GL (react-map-gl/maplibre) du module search.
 *
 * `results` GROSSIT au fil des pages (chargement progressif —
 * `useSearchAllResults`). L'index supercluster est reconstruit à chaque page
 * (opération bon marché), et `fitBounds` ne joue qu'UNE fois par périmètre
 * (1ʳᵉ page) — le viewport de l'utilisateur est préservé pendant le chargement
 * des pages suivantes (carte non contrôlée : `initialViewState` + ref).
 *
 * Clustering : supercluster regroupe selon le bbox+zoom courant (recalcul au
 * `onMoveEnd`) → on ne rend en DOM que les marqueurs réellement visibles. Les
 * marqueurs et la popup sont des composants React (plus de `renderToString` ni
 * de `window.dispatchEvent` : l'action de la popup est un handler React direct).
 *
 * Mode split (cf. SearchProStatic) : `focusedItemId` (liste→carte) recentre +
 * ouvre la popup de l'item ; `onMarkerFocus` (carte→liste) remonte l'id au clic
 * d'un marqueur ; `containerClass` laisse le parent dimensionner la colonne.
 */
export default function SearchMap({ results, card, preview, map: mapConf, focusedItemId, onMarkerFocus, containerClass }: SearchMapProps) {
  const mapRef = useRef<MapRef | null>(null);
  /** 1ᵉʳ id du périmètre déjà recadré (fitBounds une fois par périmètre). */
  const fittedFirstIdRef = useRef<string | undefined>(undefined);
  /** Ref du callback de focus sortant — évite de l'ajouter aux deps de handleSelect. */
  const onMarkerFocusRef = useRef(onMarkerFocus);
  useEffect(() => {
    onMarkerFocusRef.current = onMarkerFocus;
  }, [onMarkerFocus]);
  const [mapLoaded, setMapLoaded] = useState(false);
  // bbox + zoom courants → entrées du clustering. Recalculés au load et au moveEnd.
  const [viewport, setViewport] = useState<{ zoom: number; bbox: [number, number, number, number] } | null>(null);
  // Item sélectionné (popup ouverte) + détail modal (SwitchDetailsMode).
  const [selected, setSelected] = useState<{ entry: SearchEntity; lng: number; lat: number } | null>(null);
  const [openDetails, setOpenDetails] = useState(false);
  const [item, setItem] = useState<SearchEntity | null>(null);

  const { resolvedTheme } = useTheme();
  const t = useT("modules/search");
  const { config } = useSite();
  const navigate = useNavigate();
  const baseUrl = getBaseUrl();
  // Action au clic du bouton de popup — déclarée en config (map.itemAction) :
  // détail modal du module search (défaut) ou navigation /profil/:slug.
  const actionKind = mapConf?.itemAction?.kind ?? "preview";

  // Fond de carte : style.json vectoriel MapTiler (clé env, via @maptiler/sdk)
  // avec styles par site (`integrations.map`), sinon repli raster — cf. lib/mapStyles.ts.
  const mapStyles = config.integrations?.map;
  const styles = useMemo(() => resolveMapStyles(MAPTILER_KEY, mapStyles), [mapStyles]);
  // mapLib = @maptiler/sdk uniquement quand on a une clé (sinon MapLibre standard
  // affiche le style raster de repli). Stable sur la session (la clé est en env).
  const mapLib = styles.provider === "maptiler" ? (maptilersdk as unknown as MapLib) : undefined;
  // Bascule light/dark = changement de `mapStyle` ; react-map-gl restyle la carte
  // sans toucher aux <Marker>/<Popup> React (qui ne font pas partie du style).
  const mapStyle = resolvedTheme === "dark" ? styles.dark : styles.light;

  // Marqueur : config SITE (`integrations.map.marker`, défaut) surchargée champ
  // par champ par la SECTION (`map.marker`) ; sinon repli sur le défaut intégré.
  // Mémoïsé → référence stable passée aux PointMarker (préserve leur mémoïsation).
  const markerConf = useMemo(
    () => ({ ...mapStyles?.marker, ...mapConf?.marker }),
    [mapStyles, mapConf],
  );

  // GeoJSON points (entités géolocalisées valides) → index supercluster.
  const points = useMemo<Supercluster.PointFeature<PointProps>[]>(
    () =>
      results.flatMap((entry) => {
        const coords = (entry?.serverData as { geoPosition?: { coordinates?: unknown } } | undefined)
          ?.geoPosition?.coordinates;
        if (!isValidGeoPoint(coords)) return [];
        return [
          {
            type: "Feature" as const,
            properties: { entry },
            geometry: { type: "Point" as const, coordinates: [coords[0], coords[1]] },
          },
        ];
      }),
    [results],
  );

  const index = useMemo(() => {
    // Clustering toujours actif (parité avec la carte Leaflet historique).
    const sc = new Supercluster<PointProps>({ radius: 60, maxZoom: 16 });
    sc.load(points);
    return sc;
  }, [points]);

  const clusters = useMemo(
    () => (viewport ? index.getClusters(viewport.bbox, Math.round(viewport.zoom)) : []),
    [index, viewport],
  );

  // Lit le bbox+zoom courants depuis la carte (au load et après chaque mouvement).
  const syncViewport = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const b = map.getBounds();
    setViewport({
      zoom: map.getZoom(),
      bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
    });
  }, []);

  // Clic sur un marqueur point → ouvre la popup à ses coordonnées.
  const handleSelect = useCallback((entry: SearchEntity) => {
    const coords = (entry?.serverData as { geoPosition?: { coordinates?: unknown } } | undefined)
      ?.geoPosition?.coordinates;
    if (!isValidGeoPoint(coords)) return;
    // Synchro carte→liste : clic marqueur → remonte l'id (highlight liste, mode split).
    const id = (entry.serverData as { id?: string } | undefined)?.id;
    if (id != null) onMarkerFocusRef.current?.(String(id));
    setSelected({ entry, lng: coords[0], lat: coords[1] });
  }, []);

  // Clic sur un cluster → zoome jusqu'à l'éclatement (supercluster).
  const expandCluster = useCallback(
    (clusterId: number, lng: number, lat: number) => {
      const zoom = Math.min(index.getClusterExpansionZoom(clusterId), 18);
      mapRef.current?.getMap().easeTo({ center: [lng, lat], zoom, duration: 400 });
    },
    [index],
  );

  // Action du bouton de la popup (handler React direct — plus de DOM event).
  const handlePopupAction = useCallback(
    (entry: SearchEntity) => {
      if (actionKind === "profil") {
        const slug =
          (entry as { slug?: string }).slug ??
          (entry.serverData as { slug?: string } | undefined)?.slug;
        if (slug) {
          navigate(`/profil/${slug}`);
          return;
        }
        // sans slug, repli sur le détail modal
      }
      setItem(entry);
      setOpenDetails(true);
      setSelected(null);
    },
    [actionKind, navigate],
  );

  /* ── fitBounds UNE fois par périmètre (1ʳᵉ page) ─────────────────────── */
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoaded) return;
    const firstId = (results?.[0]?.serverData as { id?: string } | undefined)?.id;
    // Périmètre déjà recadré : les pages suivantes ne déplacent pas le viewport.
    if (firstId === fittedFirstIdRef.current) return;
    const coords = results
      .map(
        (e) =>
          (e?.serverData as { geoPosition?: { coordinates?: unknown } } | undefined)?.geoPosition
            ?.coordinates,
      )
      .filter(isValidGeoPoint);
    if (coords.length === 0) return;
    fittedFirstIdRef.current = firstId;
    if (coords.length === 1) {
      map.easeTo({ center: [coords[0][0], coords[0][1]], zoom: mapConf?.initialZoom ?? 12, duration: 400 });
      return;
    }
    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;
    for (const [lng, lat] of coords) {
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 40, maxZoom: 16, duration: 400 },
    );
  }, [results, mapLoaded, mapConf]);

  /* ── Focus (mode split) : liste→carte — recentre + ouvre la popup ─────── */
  // `results` en deps : si l'item focalisé arrive sur une page suivante, le
  // focus se rejoue. La popup est ancrée aux coordonnées (indépendante du
  // clustering) → pas besoin de dé-clusteriser pour l'ouvrir.
  useEffect(() => {
    if (!mapLoaded || !focusedItemId) return;
    const entry = results.find(
      (e) => String((e?.serverData as { id?: string } | undefined)?.id) === String(focusedItemId),
    );
    if (!entry) return; // item pas (encore) sur la carte
    const coords = (entry.serverData as { geoPosition?: { coordinates?: unknown } } | undefined)
      ?.geoPosition?.coordinates;
    if (!isValidGeoPoint(coords)) return; // sans géolocalisation → no-op
    const map = mapRef.current?.getMap();
    if (!map) return;
    map.easeTo({ center: [coords[0], coords[1]], zoom: Math.max(map.getZoom(), 14), duration: 400 });
    setSelected({ entry, lng: coords[0], lat: coords[1] });
  }, [mapLoaded, focusedItemId, results]);

  /* ── Poignée de debug (dev uniquement) ──────────────────────────────── */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__searchMapDebug = {
      map: mapRef.current?.getMap(),
      index,
      clusters,
    };
  }, [index, clusters]);

  // Dimensions du conteneur — logique PARTAGÉE avec MapSkeleton
  // (cf. useMapContainerClass : plein écran sans footer vs min-h-screen).
  // En mode split, le parent fournit `containerClass` (ex. "absolute inset-0")
  // pour que la carte remplisse sa colonne au lieu de `min-h-screen`.
  const defaultContainerClass = useMapContainerClass("z-10 rounded shadow overflow-hidden");
  const mapContainerClass = containerClass ?? defaultContainerClass;

  return (
    <>
      <div className="relative w-full h-full rounded shadow">
        <div className={mapContainerClass}>
          <Map
            ref={mapRef}
            mapLib={mapLib}
            {...(mapLib ? SDK_CONTROL_PROPS : null)}
            mapStyle={mapStyle}
            initialViewState={{ longitude: 4.5, latitude: 44.5, zoom: mapConf?.initialZoom ?? 7 }}
            reuseMaps
            onLoad={() => {
              setMapLoaded(true);
              syncViewport();
            }}
            onMoveEnd={syncViewport}
            onClick={() => setSelected(null)}
            style={{ width: "100%", height: "100vh" }}
          >
            <NavigationControl position="top-left" />

            {clusters.map((feature) => {
              const [lng, lat] = feature.geometry.coordinates;
              const props = feature.properties;
              if ("cluster" in props && props.cluster) {
                return (
                  <ClusterMarker
                    key={`cluster-${props.cluster_id}`}
                    longitude={lng}
                    latitude={lat}
                    clusterId={props.cluster_id}
                    pointCount={props.point_count}
                    totalPoints={points.length}
                    onExpand={expandCluster}
                  />
                );
              }
              const entry = (props as PointProps).entry;
              const id = (entry.serverData as { id?: string } | undefined)?.id;
              return (
                <PointMarker
                  key={`pt-${id ?? `${lng},${lat}`}`}
                  longitude={lng}
                  latitude={lat}
                  entry={entry}
                  markerConf={markerConf}
                  baseUrl={baseUrl}
                  onSelect={handleSelect}
                />
              );
            })}

            {selected && (
              <Popup
                longitude={selected.lng}
                latitude={selected.lat}
                anchor="bottom"
                offset={30}
                closeButton={false}
                closeOnClick={false}
                maxWidth="300px"
                className="search-map-popup"
                onClose={() => setSelected(null)}
              >
                <Suspense fallback={null}>
                  <SearchMapPopup
                    popup={mapConf?.popup}
                    item={selected.entry}
                    t={t}
                    actionKind={actionKind}
                    onAction={() => handlePopupAction(selected.entry)}
                  />
                </Suspense>
              </Popup>
            )}
          </Map>
        </div>
      </div>

      {item && (
        <SwitchDetailsMode
          openDetails={openDetails}
          setOpenDetails={setOpenDetails}
          item={item}
          card={card}
          preview={preview}
        />
      )}
    </>
  );
}
