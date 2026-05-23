import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useLazyTab } from "@/hooks/useLazyTab";
import { SectionRenderer } from "@/components/sections/SectionRenderer";

export function NewsTab() {
  const { entity } = useProfileEntity();
  const { shouldLoad } = useLazyTab("news");

  if (!shouldLoad) {
    return null;
  }

  return (
    <SectionRenderer
      section={{
        type: "news",
        props: {
          // Utiliser le slug pour que useNewsEntity récupère la vraie entité
          entitySlug: entity?.slug,
          maxItems: 12,
          showAddButton: true,
          showFilters: false,
          showComments: true,
          showReactions: true,
        }
      }}
    />
  );
}

export default NewsTab;
