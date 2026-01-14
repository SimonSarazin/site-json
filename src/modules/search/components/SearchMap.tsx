import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

import { renderMapPopup } from "./renderMapPopup";
import { loadLeaflet } from "@/modules/search/hooks/loadLeaflet";
import { useT } from "@/hooks/useT";
import { SearchMapProps } from "../schema";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { SwitchDetailsMode } from "./SwitchDetailsMode";
import { useSearchProps } from "../hooks/useSearchProps";
import { cn } from "@/lib/utils";
import { usePage } from "@/hooks/usePage";


export default function SearchMap({ results, card, preview }: SearchMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null);
  const markersRef = useRef<import('leaflet').MarkerClusterGroup | null>(null);
  const lightLayerRef = useRef<import('leaflet').TileLayer | null>(null);
  const darkLayerRef = useRef<import('leaflet').TileLayer | null>(null);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [openDetails, setOpenDetails] = useState(false);
  const [item, setItem] = useState<SearchEntity | null>(null);
  const t = useT("modules/search");
  const { inSection } = useSearchProps();
  const { page } = usePage();

  useEffect(() => {
    setMounted(true);
  }, []);


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

  useEffect(() => {
    if (!mounted) return;
    let map = mapInstanceRef.current;

    const initMap = async () => {
      const L = await loadLeaflet();

      if (!map) {
        map = L.map(mapRef.current!, {
          center: [44.5, 4.5],
          zoom: 7,
          scrollWheelZoom: true,
          zoomAnimation: false,
          markerZoomAnimation: false,
        });
        mapInstanceRef.current = map;

        // Calque clair
        lightLayerRef.current = L.tileLayer(
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            attribution: "© OpenStreetMap contributors",
            maxZoom: 19,
          }
        );

        // Calque sombre (Carto Dark Matter)
        darkLayerRef.current = L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          {
            attribution:
              "&copy; <a href=\"https://carto.com/attributions\">CARTO</a> &copy; OpenStreetMap contributors",
            subdomains: "abcd",
            maxZoom: 19,
          }
        );

        // Ajout initial selon le thème
        if (resolvedTheme === "dark") {
          darkLayerRef.current.addTo(map);
        } else {
          lightLayerRef.current.addTo(map);
        }
        
      }

      if (markersRef.current && map && map.hasLayer(markersRef.current)) {
        map.removeLayer(markersRef.current);
      }

      const markers = L.markerClusterGroup();
      markersRef.current = markers;

      results?.forEach((item) => {
        const serverDataSafe = item?.serverData;
        const markerId = `popup-${serverDataSafe.id}`;

        const coords = serverDataSafe.geoPosition?.coordinates;
        if (!isValidGeoPoint(coords)) return;
        const [lng, lat] = coords;
        const marker = L.marker([lat, lng]) as import('leaflet').Marker & { _customData?: unknown };

        const popupHtml = renderMapPopup({
          item,
          id: markerId,
          t
        });

        marker.bindPopup(popupHtml, {
          maxWidth: 300,
          className: "custom-leaflet-popup"
        });

        marker._customData = item;

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

        markers.addLayer(marker);
      });

      if (map) {
        map.addLayer(markers);
      }

      if (map) {
        const bounds = markers.getBounds();
        if (markers.getLayers().length > 0 && bounds.isValid()) {
          map.fitBounds(bounds, { padding: [30, 30] });
        } else {
          map.setView([44.5, 4.5], 6);
        }

        map!.whenReady(() => {
          map!.invalidateSize();
          map!.options.zoomAnimation = true;
          map!.options.markerZoomAnimation = true;
        });
      }

    };
  
    const handleOpenDetails = (e: CustomEvent) => {
      const data = e.detail as SearchEntity;
      setItem(data);
      setOpenDetails(true);
    };

    initMap();

      window.addEventListener("openDetails", handleOpenDetails as EventListener);
    return () => {
      window.removeEventListener("openDetails", handleOpenDetails as EventListener);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mounted, results, resolvedTheme]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if (resolvedTheme === "dark") {
      if (lightLayerRef.current) map.removeLayer(lightLayerRef.current);
      if (darkLayerRef.current) darkLayerRef.current.addTo(map);
    } else {
      if (darkLayerRef.current) map.removeLayer(darkLayerRef.current);
      if (lightLayerRef.current) lightLayerRef.current.addTo(map);
    }
  }, [resolvedTheme]);

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
