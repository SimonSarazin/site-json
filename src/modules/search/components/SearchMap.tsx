import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { useIsMounted } from "@/hooks/useIsMounted";

import { renderMapPopup } from "./renderMapPopup";
import { loadLeaflet } from "@/modules/search/hooks/loadLeaflet";
import { useT } from "@/hooks/useT";
import { SearchMapProps } from "../schema";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { SwitchDetailsMode } from "./SwitchDetailsMode";
import { useSearchProps } from "../hooks/useSearchProps";
import { cn } from "@/lib/utils";
import { usePage } from "@/hooks/usePage";
import { useSite } from "@/hooks/useSite";
import { getMaptilerApiKey } from "@/lib/constant/common";
import { resolveTileLayers } from "../lib/mapTiles";


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
 * Carte Leaflet du module search.
 *
 * `results` GROSSIT au fil des pages (chargement progressif —
 * `useSearchAllResults`) : la carte est créée UNE fois (effet d'init), puis
 * les markers sont ajoutés INCRÉMENTALEMENT (`addLayers` du batch de la
 * nouvelle page — pas de reconstruction O(n²)), et `fitBounds` ne joue
 * qu'UNE fois par périmètre (1ʳᵉ page) — le viewport de l'utilisateur est
 * préservé pendant le chargement des pages suivantes.
 */
export default function SearchMap({ results, card, preview }: SearchMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null);
  const markersRef = useRef<import('leaflet').MarkerClusterGroup | null>(null);
  const lightLayerRef = useRef<import('leaflet').TileLayer | null>(null);
  const darkLayerRef = useRef<import('leaflet').TileLayer | null>(null);
  const leafletRef = useRef<Awaited<ReturnType<typeof loadLeaflet>> | null>(null);
  /** Nombre d'items déjà posés sur la carte + 1ᵉʳ id (détection de reset). */
  const renderedCountRef = useRef(0);
  const firstIdRef = useRef<string | undefined>(undefined);
  const { resolvedTheme } = useTheme();
  const mounted = useIsMounted();
  const [mapReady, setMapReady] = useState(false);
  const [openDetails, setOpenDetails] = useState(false);
  const [item, setItem] = useState<SearchEntity | null>(null);
  const t = useT("modules/search");
  const { inSection } = useSearchProps();
  const { page } = usePage();
  const { config } = useSite();

  // Fond de carte : MapTiler (clé env) avec styles configurables par site
  // (`integrations.map`), sinon repli OSM/Carto — cf. lib/mapTiles.ts.
  const mapStyles = config.integrations?.map;
  const tiles = useMemo(() => resolveTileLayers(getMaptilerApiKey(), mapStyles), [mapStyles]);

  /* ── Init (une fois) : carte + calques + cluster + listener détail ───── */
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;

    const handleOpenDetails = (e: CustomEvent) => {
      setItem(e.detail as SearchEntity);
      setOpenDetails(true);
    };

    (async () => {
      const L = await loadLeaflet();
      if (cancelled || !mapRef.current || mapInstanceRef.current) return;
      leafletRef.current = L;

      const map = L.map(mapRef.current, {
        center: [44.5, 4.5],
        zoom: 7,
        // REQUIS par markercluster : le cluster est ajouté AVANT le calque de
        // tuiles (posé par l'effet « Thème ») — sans maxZoom sur la carte,
        // L.markerClusterGroup jette « Map has no maxZoom specified ».
        maxZoom: 19,
        scrollWheelZoom: true,
      });
      mapInstanceRef.current = map;

      // Aucun calque posé ici : l'effet « Thème » (déclenché par mapReady)
      // ajoute le calque correspondant au thème courant.
      lightLayerRef.current = L.tileLayer(tiles.light.url, tiles.light.options);
      darkLayerRef.current = L.tileLayer(tiles.dark.url, tiles.dark.options);

      // chunkedLoading : les addLayers par paquets de 500 (pages) ne gèlent
      // pas l'UI — le clustering est calculé par tranches.
      const markers = L.markerClusterGroup({ chunkedLoading: true });
      markersRef.current = markers;
      map.addLayer(markers);

      map.whenReady(() => map.invalidateSize());
      setMapReady(true);
    })();

    window.addEventListener("openDetails", handleOpenDetails as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener("openDetails", handleOpenDetails as EventListener);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markersRef.current = null;
      lightLayerRef.current = null;
      darkLayerRef.current = null;
      renderedCountRef.current = 0;
      firstIdRef.current = undefined;
      setMapReady(false);
    };
  }, [mounted, tiles]);

  /* ── Thème : permutation des calques (sans toucher aux markers) ──────── */
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (resolvedTheme === "dark") {
      if (lightLayerRef.current) map.removeLayer(lightLayerRef.current);
      if (darkLayerRef.current) darkLayerRef.current.addTo(map);
    } else {
      if (darkLayerRef.current) map.removeLayer(darkLayerRef.current);
      if (lightLayerRef.current) lightLayerRef.current.addTo(map);
    }
  }, [resolvedTheme, mapReady]);

  /* ── Markers : ajout INCRÉMENTAL des nouvelles pages ─────────────────── */
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markers = markersRef.current;
    const L = leafletRef.current;
    if (!mapReady || !map || !markers || !L) return;

    const firstId = results?.[0]?.serverData?.id as string | undefined;
    let from = renderedCountRef.current;
    // Reset : périmètre changé (moins d'items qu'affichés, ou 1ᵉʳ id
    // différent — nouveaux filtres avec le même nombre). Ceinture + bretelles :
    // en pratique le composant est démonté entre deux périmètres (results
    // repasse par [] pendant le chargement de la nouvelle queryKey).
    if (results.length < from || (from > 0 && firstId !== firstIdRef.current)) {
      markers.clearLayers();
      from = 0;
    }
    if (results.length === from) return;

    const batch: import('leaflet').Marker[] = [];
    for (const entry of results.slice(from)) {
      const serverDataSafe = entry?.serverData;
      const markerId = `popup-${serverDataSafe.id}`;

      const coords = serverDataSafe.geoPosition?.coordinates;
      if (!isValidGeoPoint(coords)) continue;
      const [lng, lat] = coords;
      const marker = L.marker([lat, lng]) as import('leaflet').Marker & { _customData?: unknown };

      const popupHtml = renderMapPopup({ item: entry, id: markerId, t });
      marker.bindPopup(popupHtml, {
        maxWidth: 300,
        className: "custom-leaflet-popup",
      });
      marker._customData = entry;

      marker.on("popupopen", () => {
        const popupEl = document.getElementById(markerId);
        if (!popupEl) return;
        const button = popupEl.querySelector("button[data-id]");
        if (button) {
          button.addEventListener("click", () => {
            window.dispatchEvent(
              new CustomEvent("openDetails", { detail: marker._customData })
            );
          });
        }
      });

      batch.push(marker);
    }
    markers.addLayers(batch);

    // fitBounds UNE fois par périmètre (1ᵉʳ batch) — les pages suivantes ne
    // déplacent pas le viewport de l'utilisateur.
    if (from === 0) {
      const bounds = markers.getBounds();
      if (markers.getLayers().length > 0 && bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30] });
      } else {
        map.setView([44.5, 4.5], 6);
      }
    }

    renderedCountRef.current = results.length;
    firstIdRef.current = firstId;
  }, [mapReady, results, t]);

    /**
   * Gestion des dimensions du conteneur de carte:
   * - Plein écran (absolute) si le footer est masqué et que l’on n’est pas déjà dans une section.
   * - Hauteur mini de l’écran (min-h-screen) sinon – cela couvre les deux autres cas :
   *   • Footer visible.
   *   • Carte affichée dans une section.
   */
  const mapContainerClass = cn("z-10 rounded shadow", {
    "absolute inset-0": page.hideFooter && !inSection,
    "min-h-screen": !page.hideFooter || inSection,
  });


  if (!mounted) return <div>{t("Chargement de la carte…")}</div>;

  return (
    <>
      <div className="relative w-full h-full rounded shadow">
        <div ref={mapRef} className={mapContainerClass} />
      </div>

      {item && <SwitchDetailsMode openDetails={openDetails} setOpenDetails={setOpenDetails} item={item} card={card} preview={preview} />}
    </>
  );
}
