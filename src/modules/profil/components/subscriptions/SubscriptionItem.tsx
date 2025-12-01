import { Building2, User, FolderKanban, Calendar } from "lucide-react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";
import { EntityCard } from "../shared/EntityCard";

interface SubscriptionItemProps {
  item: EntityTypes;
  isLastItem?: boolean;
  lastItemRef?: (node: HTMLAnchorElement) => void;
}

export function SubscriptionItem({ item, isLastItem, lastItemRef }: SubscriptionItemProps) {
  const t = useT("modules/profil");

  const name = (item.serverData?.name as string) || t("SubscriptionsTab.anonymousSubscription");
  const description = (item.serverData?.shortDescription as string) || (item.serverData?.description as string);
  const address = item.serverData?.address as { addressLocality?: string; postalCode?: string } | undefined;
  const thumbUrl = item.serverData?.profilImageUrl as string | undefined;
  const slug = item.serverData?.slug as string | undefined;
  const entityType = item.getEntityType?.() as string | undefined;

  const getTypeIcon = (type: string | undefined) => {
    switch (type) {
      case "organizations": return <Building2 className="w-3 h-3" />;
      case "projects": return <FolderKanban className="w-3 h-3" />;
      case "citoyens": return <User className="w-3 h-3" />;
      case "events": return <Calendar className="w-3 h-3" />;
      default: return null;
    }
  };

  const getTypeLabel = (type: string | undefined): string => {
    switch (type) {
      case "organizations": return t("SubscriptionsTab.types.organization");
      case "projects": return t("SubscriptionsTab.types.project");
      case "citoyens": return t("SubscriptionsTab.types.user");
      case "events": return t("SubscriptionsTab.types.event");
      default: return t("SubscriptionsTab.types.other");
    }
  };

  const getTypeBadgeColor = (type: string | undefined): string => {
    switch (type) {
      case "organizations": return "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "projects": return "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "citoyens": return "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800";
      case "events": return "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800";
      default: return "bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800";
    }
  };

  const typeBadge = entityType ? (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border w-fit ${getTypeBadgeColor(entityType)}`}>
      {getTypeIcon(entityType)}
      {getTypeLabel(entityType)}
    </span>
  ) : undefined;

  return (
    <EntityCard
      name={name}
      description={description}
      imageUrl={thumbUrl}
      slug={slug}
      locality={address?.addressLocality}
      postalCode={address?.postalCode}
      typeBadge={typeBadge}
      isLastItem={isLastItem}
      lastItemRef={lastItemRef}
      linkPrefix="/profil/"
    />
  );
}
