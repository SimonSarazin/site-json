import { Users } from "lucide-react";
import type { Organization } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";
import { EntityCardDetailed } from "../shared/EntityCardDetailed";

interface OrganizationItemDetailedProps {
  item: Organization;
  isLastItem?: boolean;
  lastItemRef?: (node: HTMLDivElement) => void;
}

export function OrganizationItemDetailed({ item, isLastItem, lastItemRef }: OrganizationItemDetailedProps) {
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
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
      {getTypeLabel(type)}
    </span>
  ) : undefined;

  const metadata = membersCount > 0 ? (
    <div className="flex items-center gap-1">
      <Users className="w-3 h-3" />
      <span>{membersCount} {t("OrganizationsTab.members")}</span>
    </div>
  ) : undefined;

  return (
    <EntityCardDetailed
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
