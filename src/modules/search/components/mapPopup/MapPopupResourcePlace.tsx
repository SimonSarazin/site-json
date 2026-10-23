import { ChevronRight, MapPin } from "lucide-react";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { Card, CardContent } from "@/components/ui/card";
import type { MapPopupProps } from "../../schema";

/** Un service listé dans la popup d'un lieu. */
export interface PlaceResource {
  entry: SearchEntity;
  name: string;
  /** Type affiché (« Salle de réunion », « Coworking »…), déjà traduit. */
  typeLabel?: string;
}

/** Item de carte d'un LIEU : son nom, son adresse, ses services. */
export interface ResourcePlaceItem {
  id: string;
  serverData: { name?: string; address?: { streetAddress?: string; postalCode?: string; addressLocality?: string } };
  resources: PlaceResource[];
}

/**
 * Popup d'un LIEU de l'annuaire des ressources (`map.popup.type: "resource-place"`) : un repère par lieu,
 * ses services listés — un lieu peut en porter une vingtaine, qu'un repère par service empilerait.
 * Chaque service ouvre sa fiche (`onOpenItem`, même détail que la liste).
 */
export default function MapPopupResourcePlace({ item, t, onOpenItem }: MapPopupProps) {
  const place = item as unknown as ResourcePlaceItem;
  const address = place.serverData?.address;
  const addressLine = [address?.streetAddress, address?.postalCode, address?.addressLocality].filter(Boolean).join(", ");
  const resources = place.resources ?? [];

  return (
    <Card className="max-w-72 gap-0 overflow-hidden border-border bg-background py-0 shadow-xl sm:max-w-80">
      <CardContent className="space-y-2 p-3">
        <h3 className="text-sm font-bold leading-tight text-foreground">{place.serverData?.name}</h3>
        {addressLine && (
          <p className="flex items-start gap-1 text-xs text-muted-foreground">
            <MapPin size={14} className="mt-0.5 shrink-0" />
            {addressLine}
          </p>
        )}
        <p className="text-xs font-medium text-foreground">
          {t(resources.length > 1 ? "resourceDirectory.placeServices_other" : "resourceDirectory.placeServices").replace(
            "{{count}}",
            String(resources.length),
          )}
        </p>
        {/* Défilement au-delà de quelques services : un lieu en porte jusqu'à une vingtaine. */}
        <ul className="max-h-40 space-y-1 overflow-y-auto">
          {resources.map((r) => (
            <li key={String((r.entry as { id?: unknown }).id ?? r.name)}>
              <button
                type="button"
                onClick={() => onOpenItem?.(r.entry)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-foreground">{r.name}</span>
                  {r.typeLabel && <span className="block truncate text-xs text-muted-foreground">{r.typeLabel}</span>}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
