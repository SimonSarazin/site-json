import { Building2, User, FolderKanban, Calendar } from "lucide-react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";
import { EntityCardDetailed } from "../shared/EntityCardDetailed";

interface SubscriptionItemDetailedProps {
  item: EntityTypes;
  isLastItem?: boolean;
  lastItemRef?: (node: HTMLDivElement) => void;
}

export function SubscriptionItemDetailed({ item, isLastItem, lastItemRef }: SubscriptionItemDetailedProps) {
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
      case "organizations": return "bg-info/10 text-info border-info/30";
      case "projects": return "bg-chart-2/10 text-chart-2 border-chart-2/30";
      case "citoyens": return "bg-success/10 text-success border-success/30";
      case "events": return "bg-warning/10 text-warning border-warning/30";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const typeBadge = entityType ? (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${getTypeBadgeColor(entityType)}`}>
      {getTypeIcon(entityType)}
      {getTypeLabel(entityType)}
    </span>
  ) : undefined;

  return (
    <EntityCardDetailed
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
