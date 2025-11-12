import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SearchEntity } from "@/modules/search/schema";
import { useEntityProfile } from "../hooks/useEntityProfile";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/components/profile/i18n";

interface ProfileMapProps {
  section: {
    type: "profile-map";
    height?: string;
    zoom?: number;
    showMarker?: boolean;
  };
  entity: SearchEntity;
}

export default function ProfileMap({ section, entity }: ProfileMapProps) {
  useLoadNamespace("components/profile");
  const t = useT("components/profile");
  
  const { geo } = useEntityProfile(entity);

  if (!geo || !geo.latitude || !geo.longitude) {
    return null;
  }

  const lat = parseFloat(String(geo.latitude));
  const lon = parseFloat(String(geo.longitude));

  if (isNaN(lat) || isNaN(lon)) {
    return null;
  }

  const height = section.height || "400px";

  // Note: Pour une vraie carte, utilisez Leaflet ou Google Maps
  // Ici on affiche juste un placeholder avec les coordonnées
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t("ProfileMap.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="bg-gray-100 rounded-lg flex items-center justify-center"
          style={{ height }}
        >
          <div className="text-center text-gray-600">
            <p>{t("ProfileMap.mapPlaceholder")}</p>
            <p className="text-sm mt-2">
              {t("ProfileMap.coordinates")}: {lat.toFixed(6)}, {lon.toFixed(6)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
