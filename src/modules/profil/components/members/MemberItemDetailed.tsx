import type { User, Organization } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";
import { EntityCardDetailed } from "../shared/EntityCardDetailed";
import { useUserStatusBadge } from "../../hooks/useUserStatusBadge";
import { useProfileEntity } from "../../hooks/useProfileEntity";

interface MemberItemDetailedProps {
  item: User | Organization;
  isLastItem?: boolean;
  lastItemRef?: (node: HTMLDivElement) => void;
}

export function MemberItemDetailed({ item, isLastItem, lastItemRef }: MemberItemDetailedProps) {
  const t = useT("modules/profil");
  const { getUserStatusBadge } = useUserStatusBadge();
  const { entity } = useProfileEntity();

  const name = (item.serverData?.name as string) || t("MembersTab.anonymousMember");
  const description = (item.serverData?.shortDescription as string) || (item.serverData?.description as string);
  const address = item.serverData?.address as { addressLocality?: string; postalCode?: string } | undefined;
  const thumbUrl = item.serverData?.profilImageUrl as string | undefined;
  const slug = item.serverData?.slug as string | undefined;

  const roleBadge = getUserStatusBadge(item, entity);

  return (
    <EntityCardDetailed
      name={name}
      description={description}
      imageUrl={thumbUrl}
      slug={slug}
      locality={address?.addressLocality}
      postalCode={address?.postalCode}
      typeBadge={roleBadge}
      isLastItem={isLastItem}
      lastItemRef={lastItemRef}
      linkPrefix="/profil/"
    />
  );
}
