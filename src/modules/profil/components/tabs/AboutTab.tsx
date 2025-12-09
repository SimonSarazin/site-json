import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import "@/modules/profil/i18n";

import { DescriptionSection } from "./about/DescriptionSection";
import { InfoGeneralSection } from "./about/InfoGeneralSection";
import { SocialNetworksSection } from "./about/SocialNetworksSection";
import { BadgesSection } from "./about/BadgesSection";
import { OpeningHoursSection } from "./about/OpeningHoursSection";
import { AddressSection } from "./about/AddressSection";

export function AboutTab() {
  const { entity, entityType } = useProfileEntity();
  useLoadNamespace("modules/profil");

  if (!entity) {
    return null;
  }

  const collection = entityType || entity.serverData?.collection;

  return (
    <div className="px-4">
      <div className="p-2 text-foreground">
        <ol className="relative border-s border-teal-600 mb-5">
          <DescriptionSection entity={entity} entityType={collection} />

          <InfoGeneralSection entity={entity} entityType={collection} />

          {collection !== "poi" && (
            <SocialNetworksSection entity={entity} entityType={collection} />
          )}

          <BadgesSection entity={entity} />

          {collection !== "poi" && collection !== "citoyens" && (
            <OpeningHoursSection entity={entity} entityType={collection} />
          )}

          <AddressSection entity={entity} />
        </ol>
      </div>
    </div>
  );
}
