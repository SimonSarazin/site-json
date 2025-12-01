import type { Project } from "@communecter/cocolight-api-client";
import { formatDate } from "@/helpers/formatDate";
import { useT } from "@/hooks/useT";
import { EntityCard } from "../shared/EntityCard";

interface ProjectItemProps {
  item: Project;
  isLastItem?: boolean;
  lastItemRef?: (node: HTMLAnchorElement) => void;
}

export function ProjectItem({ item, isLastItem, lastItemRef }: ProjectItemProps) {
  const t = useT("modules/profil");

  const projectName = (item.serverData?.name as string) || t("ProjectsTab.anonymousProject");
  const description = (item.serverData?.shortDescription as string) || (item.serverData?.description as string);
  const startDate = item.serverData?.startDate as Date | undefined;
  const endDate = item.serverData?.endDate as Date | undefined;
  const address = item.serverData?.address as { addressLocality?: string; postalCode?: string } | undefined;
  const thumbUrl = item.serverData?.profilImageUrl as string | undefined;
  const slug = item.serverData?.slug as string | undefined;
  const tags = item.serverData?.tags as string[] | undefined;

  return (
    <EntityCard
      name={projectName}
      description={description}
      imageUrl={thumbUrl}
      slug={slug}
      locality={address?.addressLocality}
      postalCode={address?.postalCode}
      startDate={startDate}
      endDate={endDate}
      formatDate={formatDate}
      tags={tags}
      maxTags={2}
      moreTagsLabel={t("ProjectsTab.moreTags")}
      isLastItem={isLastItem}
      lastItemRef={lastItemRef}
      linkPrefix="/profil/"
    />
  );
}
