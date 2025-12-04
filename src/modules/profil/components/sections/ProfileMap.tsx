import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormatProfileEntity } from "../../hooks/useFormatProfileEntity";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import "@/modules/profil/i18n";

interface ProfileMapProps {
  section: {
    type: "profile-map";
    height?: string;
    zoom?: number;
    showMarker?: boolean;
  };
}

export default function ProfileMap({ section }: ProfileMapProps) {
  const { entity } = useProfileEntity();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  
  const { geo } = useFormatProfileEntity(entity);

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
          className="bg-muted rounded-lg flex items-center justify-center"
          style={{ height }}
        >
          <div className="text-center text-muted-foreground">
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
