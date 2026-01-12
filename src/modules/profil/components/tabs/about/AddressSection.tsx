import { useState } from "react";
import { MapPin, Pencil, Navigation, ExternalLink } from "lucide-react";
import { useT } from "@/hooks/useT";
import type { ProfileEntity } from "@/modules/profil/types";
import { useProfileMutations } from "@/modules/profil/hooks/useProfileMutations";
import { EditAddressModal } from "./edit/EditAddressModal";

interface AddressSectionProps {
  entity: ProfileEntity;
}

interface AddressData {
  "@type"?: "PostalAddress";
  streetAddress?: string;
  addressLocality?: string;
  postalCode?: string;
  level1Name?: string;
  level3Name?: string;
  addressCountry?: string;
  localityId?: string;
  codeInsee?: string;
  level1?: string;
  level2?: string;
  level2Name?: string;
  level3?: string;
  level4?: string;
  level4Name?: string;
}

interface GeoData {
  "@type"?: string;
  latitude?: number | string;
  longitude?: number | string;
}

export function AddressSection({ entity }: AddressSectionProps) {
  const t = useT("modules/profil");
  const { canEdit } = useProfileMutations();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const address = entity.serverData?.address as AddressData | undefined;
  const geo = entity.serverData?.geo as GeoData | undefined;

  const addressParts = [
    address?.streetAddress,
    address?.postalCode,
    address?.addressLocality,
    address?.level3Name,
    address?.level1Name,
  ].filter(Boolean);

  const addressDisplay = addressParts.join(", ");

  const hasAddress = address && (address.addressLocality || address.streetAddress);
  const hasGeo = geo && geo.latitude && geo.longitude;

  const getGoogleMapsLink = () => {
    if (hasGeo) {
      return `https://www.google.com/maps?q=${geo.latitude},${geo.longitude}`;
    }
    if (addressDisplay) {
      return `https://www.google.com/maps/search/${encodeURIComponent(addressDisplay)}`;
    }
    return null;
  };

  const mapsLink = getGoogleMapsLink();

  return (
    <li className={`ms-6 w-full mb-4 group ${canEdit ? "hover:bg-muted/50 hover:rounded-lg p-2 -ml-3 pl-8 transition-colors" : ""}`}>
      <span className="absolute flex items-center justify-center w-6 h-6 rounded-full -start-3 ring-8 ring-background bg-primary text-primary-foreground">
        <MapPin className="w-3 h-3" />
      </span>
      <div className="flex justify-between items-center">
        <h2 className="flex items-center mb-1 text-base font-semibold text-foreground uppercase">
          {t("AboutTab.address")}
        </h2>
        {canEdit && (
          <button
            onClick={() => setIsEditOpen(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
            aria-label={String(t("EditAbout.edit"))}
          >
            <Pencil className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {hasAddress ? (
        <div className="mt-2 space-y-3">
          <div className="bg-linear-to-br from-primary/10 to-primary/5 rounded-lg p-4 border border-primary/20">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/20 rounded-full shrink-0">
                <Navigation className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                {address?.streetAddress && (
                  <p className="font-medium text-foreground">
                    {address.streetAddress}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  {[
                    address?.postalCode,
                    address?.addressLocality,
                  ].filter(Boolean).join(" ")}
                </p>
                {(address?.level3Name || address?.level1Name) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {[address?.level3Name, address?.level1Name].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
              {mapsLink && (
                <a
                  href={mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors shrink-0"
                  title={String(t("AboutTab.openInMaps"))}
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {hasGeo && (
            <div className="relative w-full h-52 rounded-lg overflow-hidden border border-border shadow-sm group/map">
              <iframe
                title="Location map"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(geo.longitude) - 0.008}%2C${Number(geo.latitude) - 0.008}%2C${Number(geo.longitude) + 0.008}%2C${Number(geo.latitude) + 0.008}&layer=mapnik&marker=${geo.latitude}%2C${geo.longitude}`}
              />
              <div className="absolute bottom-2 right-2 opacity-0 group-hover/map:opacity-100 transition-opacity">
                {mapsLink && (
                  <a
                    href={mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-card rounded-full shadow-md text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Navigation className="w-3 h-3" />
                    {t("AboutTab.getDirections")}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-2">
          {canEdit ? (
            <button
              onClick={() => setIsEditOpen(true)}
              className="flex items-center gap-2 px-4 py-3 w-full text-sm text-muted-foreground border-2 border-dashed border-muted-foreground/30 rounded-lg hover:border-primary hover:text-primary hover:bg-primary/10 transition-all"
            >
              <MapPin className="w-4 h-4" />
              {t("AboutTab.addAddress")}
            </button>
          ) : (
            <span className="text-sm text-muted-foreground block">
              {t("AboutTab.addressNotProvided")}
            </span>
          )}
        </div>
      )}

      {canEdit && (
        <EditAddressModal
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          initialAddress={address}
          initialGeo={geo as { "@type"?: string; latitude: string | number; longitude: string | number } | null | undefined}
        />
      )}
    </li>
  );
}
