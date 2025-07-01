import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

import { useCocolight } from "@/hooks/useCocolight";
import Preview from "@/modules/search/components/Preview";

import { renderMapPopup } from "./MapPopup";
import { loadLeaflet } from "@/modules/search/hooks/loadLeaflet";
import CustomDrawer from "@/components/layout/CustomDrawer";
import { useT } from "@/hooks/useT";

interface SearchMapProps {
  results: any[];
}

export default function SearchMap({ results }: SearchMapProps) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(null);
  const lightLayerRef = useRef(null);
  const darkLayerRef = useRef(null);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [openDetailsDrawer, setOpenDetailsDrawer] = useState(false);
  const [dataToProfile, setDataToProfile] = useState(null);
  const { setDataToProfile: setContextDataToProfiles } = useCocolight();
  const t = useT("modules/search");


  useEffect(() => {
    setMounted(true);
  }, []);


  function isValidGeoPoint(coords) {
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
        map = L.map(mapRef.current, {
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

      if (markersRef.current && map.hasLayer(markersRef.current)) {
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
        const marker = L.marker([lat, lng]);

        const popupHtml = renderMapPopup({
          name: serverDataSafe.name,
          tags: serverDataSafe.tags,
          address: serverDataSafe.address,
          shortDescription: serverDataSafe.shortDescription,
          id: markerId,
          t
        });

        marker.bindPopup(popupHtml, {
          maxWidth: 300,
          className: "custom-leaflet-popup"
        });

        marker._customData = item;

        // eslint-disable-next-line no-unused-vars
        marker.on("popupopen", (e) => {
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

      map.addLayer(markers);

      const bounds = markers.getBounds();
      if (markers.getLayers().length > 0 && bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30] });
      } else {
        map.setView([44.5, 4.5], 6);
      }

      map.whenReady(() => {
        map.invalidateSize();
        map.options.zoomAnimation = true;
        map.options.markerZoomAnimation = true;
      });
    };
  
    const handleOpenDetails = (e) => {
      const data = e.detail;
      const detailsData = data.serverData;
      setDataToProfile(detailsData);
      setContextDataToProfiles(data);
      setOpenDetailsDrawer(true);
    };

    initMap();

    window.addEventListener("openDetails", handleOpenDetails);
    return () => {
      window.removeEventListener("openDetails", handleOpenDetails);
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
      map.removeLayer(lightLayerRef.current);
      darkLayerRef.current.addTo(map);
    } else {
      map.removeLayer(darkLayerRef.current);
      lightLayerRef.current.addTo(map);
    }
  }, [resolvedTheme]);

  if (!mounted) return <div>{t("Chargement de la carte…")}</div>;

  return (
    <>
      <div className="relative w-full h-full rounded shadow">
        <div ref={mapRef} className="w-full min-h-screen z-49" />
      </div>
      {
        openDetailsDrawer &&
        <CustomDrawer
          isOpenDrawer={openDetailsDrawer}
          openAndCloseDrawer={() => setOpenDetailsDrawer(false)}
          direction={"right"}
          openPageTitle={t("Aller sur la page")}
          overflowType="overflow-hidden"
          link={{
            pathname: `/@${dataToProfile?.slug}`,
          }}
        >
          <Preview
            data={dataToProfile}
          />
        </CustomDrawer>
      }
    </>
  );
}
