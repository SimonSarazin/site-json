import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SearchEntity } from "@/modules/search/schema";

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
  // Vérifier si l'entité a des coordonnées géographiques
  const hasGeo = "geo" in entity && entity.geo &&
    "latitude" in (entity.geo as any) && "longitude" in (entity.geo as any);

  if (!hasGeo) {
    return null;
  }

  const geo = entity.geo as any;
  const lat = parseFloat(geo.latitude);
  const lon = parseFloat(geo.longitude);
  const height = section.height || "400px";

  // Note: Pour une vraie carte, utilisez Leaflet ou Google Maps
  // Ici on affiche juste un placeholder avec les coordonnées
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Localisation</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="bg-gray-100 rounded-lg flex items-center justify-center"
          style={{ height }}
        >
          <div className="text-center text-gray-600">
            <p>Carte à implémenter</p>
            <p className="text-sm mt-2">
              Coordonnées: {lat.toFixed(6)}, {lon.toFixed(6)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
