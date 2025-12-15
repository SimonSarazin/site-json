import { Users } from "lucide-react";
import type { Organization } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";
import { EntityCard } from "../shared/EntityCard";

interface OrganizationItemProps {
  item: Organization;
  isLastItem?: boolean;
  lastItemRef?: (node: HTMLAnchorElement) => void;
}

export function OrganizationItem({ item, isLastItem, lastItemRef }: OrganizationItemProps) {
  const t = useT("modules/profil");

  const orgName = (item.serverData?.name as string) || t("OrganizationsTab.anonymousOrganization");
  const description = (item.serverData?.shortDescription as string) || (item.serverData?.description as string);
  const address = item.serverData?.address as { addressLocality?: string; postalCode?: string } | undefined;
  const thumbUrl = item.serverData?.profilImageUrl as string | undefined;
  const slug = item.serverData?.slug as string | undefined;
  const type = item.serverData?.type as string | undefined;
  const membersCount = (item.serverData?.links as { members?: Record<string, unknown> })?.members
    ? Object.keys((item.serverData?.links as { members?: Record<string, unknown> }).members || {}).length
    : 0;

  const getTypeLabel = (orgType: string | undefined): string => {
    switch (orgType) {
      case "NGO": return t("OrganizationsTab.types.ngo");
      case "Cooperative": return t("OrganizationsTab.types.cooperative");
      case "LocalBusiness": return t("OrganizationsTab.types.localBusiness");
      case "Group": return t("OrganizationsTab.types.group");
      case "GovernmentOrganization": return t("OrganizationsTab.types.government");
      default: return t("OrganizationsTab.types.organization");
    }
  };

  const typeBadge = type ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-info/10 text-info border border-info/30 w-fit">
      {getTypeLabel(type)}
    </span>
  ) : undefined;

  const metadata = membersCount > 0 ? (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Users className="w-3 h-3" />
      <span>{membersCount} {t("OrganizationsTab.members")}</span>
    </div>
  ) : undefined;

  return (
    <EntityCard
      name={orgName}
      description={description}
      imageUrl={thumbUrl}
      slug={slug}
      locality={address?.addressLocality}
      postalCode={address?.postalCode}
      typeBadge={typeBadge}
      metadata={metadata}
      isLastItem={isLastItem}
      lastItemRef={lastItemRef}
      linkPrefix="/profil/"
    />
  );
}
