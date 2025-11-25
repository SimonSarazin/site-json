import type { User } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";
import { EntityCard } from "../shared/EntityCard";

interface SubscriberItemProps {
  item: User;
  isLastItem?: boolean;
  lastItemRef?: (node: HTMLAnchorElement) => void;
}

export function SubscriberItem({ item, isLastItem, lastItemRef }: SubscriberItemProps) {
  const t = useT("modules/profil");

  const name = (item.serverData?.name as string) || t("SubscribersTab.anonymousSubscriber");
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
