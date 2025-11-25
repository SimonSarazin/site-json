import type { User, Organization } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";
import { EntityCard } from "../shared/EntityCard";

interface ContributorItemProps {
  item: User | Organization;
  isLastItem?: boolean;
  lastItemRef?: (node: HTMLAnchorElement) => void;
}

export function ContributorItem({ item, isLastItem, lastItemRef }: ContributorItemProps) {
  const t = useT("modules/profil");

  const name = (item.serverData?.name as string) || t("ContributorsTab.anonymousContributor");
  const description = (item.serverData?.shortDescription as string) || (item.serverData?.description as string);
  const address = item.serverData?.address as { addressLocality?: string; postalCode?: string } | undefined;
  const thumbUrl = item.serverData?.profilImageUrl as string | undefined;
  const slug = item.serverData?.slug as string | undefined;

  return (
    <EntityCard
      name={name}
      description={description}
      imageUrl={thumbUrl}
      slug={slug}
      locality={address?.addressLocality}
      postalCode={address?.postalCode}
      isLastItem={isLastItem}
      lastItemRef={lastItemRef}
      linkPrefix="/profil/"
    />
  );
}
