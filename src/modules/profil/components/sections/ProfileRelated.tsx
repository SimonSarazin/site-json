import { useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useRelatedEntities, type RelationType } from "../../hooks/useRelatedEntities";
import { EntityCard, getEntityIcon } from "../shared/EntityCard";
import { EntityGrid } from "../shared/EntityGrid";
import { EntityEmptyState } from "../shared/EntityEmptyState";
import type { ProfileRelatedSection } from "../../schema";

interface ProfileRelatedProps {
  section: ProfileRelatedSection;
}

function mapRelationType(type: string | undefined): RelationType {
  // Valider que le type est supporté par le hook
  if (type === "projects" || type === "events" || type === "poi") {
    return type;
  }
  // Les types "parent" et "children" ne sont pas encore supportés
  return "projects";
}

export default function ProfileRelated({ section }: ProfileRelatedProps) {
  const { entity } = useProfileEntity();
  const t = useT("modules/profil");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);

  const { limit = 20, title } = section;

  const relationType = mapRelationType(section.relationType);

  const {
    entities,
    totalCount,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
  } = useRelatedEntities(entity, relationType, {
    search: debouncedSearch,
    indexStep: limit,
  });

  const getEmptyTitle = () => {
    switch (relationType) {
      case "projects":
        return t("ProfileRelated.empty.projects");
      case "events":
        return t("ProfileRelated.empty.events");
      case "poi":
        return t("ProfileRelated.empty.poi");
    }
  };

  return (
    <div className="space-y-6">
      {/* Titre optionnel */}
      {title && (
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">
            {t(title)}
          </h2>
          {totalCount > 0 && (
            <span className="text-sm text-muted-foreground">
              {totalCount} {totalCount === 1 ? t("ProfileRelated.result") : t("ProfileRelated.results")}
            </span>
          )}
        </div>
      )}

      {/* Grille avec recherche intégrée */}
      <EntityGrid
        items={entities}
        isLoading={isLoading}
        isFetchingNext={isFetchingNextPage}
        hasNextPage={hasNextPage}
        lastItemRef={lastItemRef}
        columns={{ sm: 1, md: 2, lg: 2, xl: 3 }}
        searchEnabled={true}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={t("ProfileRelated.searchPlaceholder")}
        renderItem={(item, _index, isLast, ref) => (
          <EntityCard
            key={item.id || item.slug}
            entity={item}
            showRole={false}
            lastItemRef={isLast && hasNextPage ? ref : undefined}
          />
        )}
        emptyState={
          <EntityEmptyState
            icon={getEntityIcon(relationType)}
            title={getEmptyTitle()}
            description={
              searchTerm
                ? t("ProfileRelated.tryDifferentSearch")
                : t("ProfileRelated.noRelatedEntities")
            }
          />
        }
      />
    </div>
  );
}
