import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { loadLeaflet } from "@/modules/search/hooks/loadLeaflet";
import { useIsMounted } from "@/hooks/useIsMounted";

interface ProfileMapLeafletProps {
  lat: number;
  lng: number;
  height?: string;
  zoom?: number;
  showMarker?: boolean;
}

export default function ProfileMapLeaflet({
  lat,
  lng,
  height = "400px",
  zoom = 15,
  showMarker = true,
}: ProfileMapLeafletProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const lightLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const darkLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const { resolvedTheme } = useTheme();
  const mounted = useIsMounted();

  // Initialisation de la carte
  useEffect(() => {
    if (!mounted || !mapRef.current) return;

    let map = mapInstanceRef.current;

    const initMap = async () => {
      const L = await loadLeaflet();

      if (!map) {
        map = L.map(mapRef.current!, {
          center: [lat, lng],
          zoom,
          scrollWheelZoom: true,
          zoomAnimation: true,
          markerZoomAnimation: true,
        });
        mapInstanceRef.current = map;

        // Calque clair (OpenStreetMap)
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
              '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap contributors',
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

        // Ajouter le marker si demandé
        if (showMarker) {
          markerRef.current = L.marker([lat, lng]).addTo(map);
        }
      }

      // Invalider la taille après montage
      map?.whenReady(() => {
        map?.invalidateSize();
      });
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mounted, lat, lng, zoom, showMarker, resolvedTheme]);

  // Gestion du changement de thème
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !lightLayerRef.current || !darkLayerRef.current) return;

    if (resolvedTheme === "dark") {
      if (map.hasLayer(lightLayerRef.current)) {
        map.removeLayer(lightLayerRef.current);
      }
      if (!map.hasLayer(darkLayerRef.current)) {
        darkLayerRef.current.addTo(map);
      }
    } else {
      if (map.hasLayer(darkLayerRef.current)) {
        map.removeLayer(darkLayerRef.current);
      }
      if (!map.hasLayer(lightLayerRef.current)) {
        lightLayerRef.current.addTo(map);
      }
    }
  }, [resolvedTheme]);

  // Mise à jour de la position du marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    const marker = markerRef.current;

    if (map && marker) {
      marker.setLatLng([lat, lng]);
      map.setView([lat, lng], zoom);
    }
  }, [lat, lng, zoom]);

  return (
    <div
      ref={mapRef}
      className="w-full rounded-lg overflow-hidden"
      style={{ height }}
    />
  );
}
