import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/hooks/useT";
import type { User, Organization, SearchEntity } from "@communecter/cocolight-api-client";
import { SwitchDetailsMode } from "@/modules/search/components/SwitchDetailsMode";
import { loadLeaflet } from "@/modules/search/hooks/loadLeaflet";
import { cn } from "@/lib/utils";

interface MemberMapProps {
  members: (User | Organization)[];
  card?: {
    type?: "default" | "profile";
    showDescription?: boolean;
    showAddress?: boolean;
    detailsMode?: "drawer" | "dialog" | "link";
  };
}

interface MemberData {
  id?: string;
  name?: string;
  profilThumbImageUrl?: string;
  geoPosition?: { coordinates?: number[] };
  geo?: { latitude?: string | number; longitude?: string | number };
  address?: { streetAddress?: string };
  [key: string]: unknown;
}

function getData(member: User | Organization): MemberData {
  return ((member as unknown as { serverData?: MemberData }).serverData || member) as MemberData;
}

function getCoordinates(member: User | Organization): [number, number] | null {
  const data = getData(member);

  const geoPos = data.geoPosition?.coordinates;
  if (Array.isArray(geoPos) && geoPos.length === 2 && isValidCoord(geoPos[1], geoPos[0])) {
    return [geoPos[0], geoPos[1]];
  }

  const geo = data.geo;
  if (geo?.latitude !== undefined && geo?.longitude !== undefined) {
    const lat = typeof geo.latitude === "string" ? parseFloat(geo.latitude) : geo.latitude;
    const lng = typeof geo.longitude === "string" ? parseFloat(geo.longitude) : geo.longitude;
    if (isValidCoord(lat, lng)) return [lng, lat];
  }

  return null;
}

function isValidCoord(lat: number, lng: number) {
  return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function renderPopup(member: User | Organization, id: string, t: (key: string) => string): string {
  const data = getData(member);
  return `
    <div id="${id}" class="flex flex-col gap-2 p-2 min-w-[200px]">
      <div class="flex items-center gap-3">
        ${data.profilThumbImageUrl ? `<img src="${data.profilThumbImageUrl}" alt="${data.name}" class="w-10 h-10 rounded-full object-cover" />` : ""}
        <div class="font-semibold">${data.name || "Membre"}</div>
      </div>
      ${data.address?.streetAddress ? `<div class="text-sm text-muted-foreground">${data.address.streetAddress}</div>` : ""}
      <button data-id="${id}" class="mt-2 px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90">
        ${t("Voir le profil")}
      </button>
    </div>
  `;
}

export default function MemberMap({ members, card }: MemberMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<import("leaflet").MarkerClusterGroup | null>(null);
  const lightLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const darkLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [openDetails, setOpenDetails] = useState(false);
  const [selectedMember, setSelectedMember] = useState<User | Organization | null>(null);
  const [membersWithGeo, setMembersWithGeo] = useState(0);
  const t = useT("modules/profil");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;

    const initMap = async () => {
      const L = await loadLeaflet();
      let map = mapInstanceRef.current;

      if (!map) {
        map = L.map(mapRef.current!, {
          center: [-21.1, 55.5],
          zoom: 10,
          scrollWheelZoom: true,
        });
        mapInstanceRef.current = map;

        lightLayerRef.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 19,
        });

        darkLayerRef.current = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          attribution: '&copy; CARTO &copy; OpenStreetMap contributors',
          subdomains: "abcd",
          maxZoom: 19,
        });

        (resolvedTheme === "dark" ? darkLayerRef : lightLayerRef).current?.addTo(map);
      }

      if (markersRef.current && map.hasLayer(markersRef.current)) {
        map.removeLayer(markersRef.current);
      }

      const markers = L.markerClusterGroup();
      markersRef.current = markers;

      let geoCount = 0;
      members?.forEach((member) => {
        const coords = getCoordinates(member);
        if (!coords) return;
        geoCount++;

        const [lng, lat] = coords;
        const data = getData(member);
        const markerId = `popup-member-${data.id || member.id}`;
        const marker = L.marker([lat, lng]) as import("leaflet").Marker & { _customData?: User | Organization };

        marker.bindPopup(renderPopup(member, markerId, t), { maxWidth: 300 });
        marker._customData = member;

        marker.on("popupopen", () => {
          document.getElementById(markerId)?.querySelector("button[data-id]")?.addEventListener("click", () => {
            window.dispatchEvent(new CustomEvent("openMemberDetails", { detail: marker._customData }));
          });
        });

        markers.addLayer(marker);
      });

      setMembersWithGeo(geoCount);
      map.addLayer(markers);

      const bounds = markers.getBounds();
      if (markers.getLayers().length > 0 && bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    };

    const handleOpenDetails = (e: Event) => {
      const member = (e as CustomEvent).detail as User | Organization;
      setSelectedMember(member);
      setOpenDetails(true);
    };

    initMap();
    window.addEventListener("openMemberDetails", handleOpenDetails);

    return () => {
      window.removeEventListener("openMemberDetails", handleOpenDetails);
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, [mounted, members, resolvedTheme, t]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (resolvedTheme === "dark") {
      if (lightLayerRef.current) map.removeLayer(lightLayerRef.current);
      darkLayerRef.current?.addTo(map);
    } else {
      if (darkLayerRef.current) map.removeLayer(darkLayerRef.current);
      lightLayerRef.current?.addTo(map);
    }
  }, [resolvedTheme]);

  if (!mounted) return <div className="p-4 text-muted-foreground">{t("Chargement de la carte…")}</div>;

  const detailsMode = card?.detailsMode === "link" ? undefined : card?.detailsMode;

  return (
    <>
      <div className="relative w-full h-full rounded shadow">
        <div ref={mapRef} className={cn("z-10 rounded shadow min-h-100 h-full")} />
        {membersWithGeo === 0 && members.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-20">
            <p className="text-muted-foreground text-center p-4">
              {t("Aucun membre avec une localisation géographique")}
            </p>
          </div>
        )}
      </div>

      {selectedMember && detailsMode && (
        <SwitchDetailsMode
          openDetails={openDetails}
          setOpenDetails={setOpenDetails}
          item={selectedMember as unknown as SearchEntity}
          card={{ detailsMode }}
        />
      )}
    </>
  );
}
