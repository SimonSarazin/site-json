import { MapPin } from 'lucide-react';
import { useLocalization } from "@/hooks/useLocalization";

interface MapSectionProps {
  id?: string;
  props: {
    provider?: 'leaflet' | 'google' | 'mapbox';
    center: [number, number];
    zoom?: number;
    markers?: Array<{
      position: [number, number];
      label?: Record<string, string>;
      popup?: Record<string, string>;
    }>;
  };
}

export function MapSection({ id, props }: MapSectionProps) {
  const { t } = useLocalization();
  const { provider = 'leaflet', center, markers = [] } = props;

  // For now, we'll show a placeholder since implementing full map functionality
  // would require additional dependencies
  return (
    <section id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-muted rounded-lg border aspect-video flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Carte Interactive</h3>
              <p className="text-muted-foreground">
                Carte {provider} centrée sur [{center[0]}, {center[1]}]
              </p>
              {markers.length > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  {markers.length} marqueur(s) disponible(s)
                </p>
              )}
            </div>
          </div>
          
          {/* Markers list */}
          {markers.length > 0 && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {markers.map((marker, index) => (
                <div key={index} className="bg-card rounded-lg border p-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-primary mt-1" />
                    <div>
                      {marker.label && (
                        <h4 className="font-semibold">{t(marker.label)}</h4>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {marker.position[0]}, {marker.position[1]}
                      </p>
                      {marker.popup && (
                        <p className="text-sm mt-2">{t(marker.popup)}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}