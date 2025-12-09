import { MapPin } from "lucide-react";
import { useT } from "@/hooks/useT";
import type { ProfileEntity } from "@/modules/profil/types";

interface AddressSectionProps {
  entity: ProfileEntity;
}

interface AddressData {
  streetAddress?: string;
  addressLocality?: string;
  postalCode?: string;
  level1Name?: string;
  addressCountry?: string;
}

interface GeoData {
  latitude?: number;
  longitude?: number;
}

export function AddressSection({ entity }: AddressSectionProps) {
  const t = useT("modules/profil");

  const address = entity.serverData?.address as AddressData | undefined;
  const geo = entity.serverData?.geo as GeoData | undefined;

  const addressParts = [
    address?.streetAddress,
    address?.addressLocality,
    address?.level1Name,
  ].filter(Boolean);

  const addressDisplay = addressParts.join(" / ");

  const hasAddress = address && geo;

  return (
    <li className="ms-6 w-full mb-4">
      <span className="absolute flex items-center justify-center w-6 h-6 rounded-full -start-3 ring-8 ring-background bg-teal-600 text-white">
        <MapPin className="w-3 h-3" />
      </span>
      <div className="flex justify-between">
        <h2 className="flex items-center mb-1 text-base font-semibold text-foreground uppercase">
          {t("AboutTab.address")}
        </h2>
      </div>
      {hasAddress ? (
        <div className="mt-2">
          <span className="text-sm font-normal text-foreground block mb-3">
            {addressDisplay}
          </span>
          {geo.latitude && geo.longitude && (
            <div className="w-full h-48 rounded-lg overflow-hidden border border-border">
              <iframe
                title="Location map"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${geo.longitude - 0.01}%2C${geo.latitude - 0.01}%2C${geo.longitude + 0.01}%2C${geo.latitude + 0.01}&layer=mapnik&marker=${geo.latitude}%2C${geo.longitude}`}
              />
            </div>
          )}
        </div>
      ) : (
        <span className="text-sm text-muted-foreground mt-2 block">
          {t("AboutTab.addressNotProvided")}
        </span>
      )}
    </li>
  );
}
