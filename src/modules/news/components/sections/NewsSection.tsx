import { Calendar } from "lucide-react";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useLazyTab } from "@/hooks/useLazyTab";
import type { NewsSection as NewsSectionType } from "../../schema";
import { useNewsEntity } from "../../hooks/useNewsEntity";
import { NewsFeed } from "../NewsFeed";
import "../../i18n";

interface NewsSectionProps {
  id?: string;
  props: NewsSectionType["props"];
}

export const NewsSection = ({ id, props }: NewsSectionProps) => {
  useLoadNamespace("modules/news");
  const t = useT("modules/news");

  // Résoudre l'entité avec la logique propre
  const {
    entity,
    entityType,
    isLoading: isLoadingEntity,
    isError: isErrorEntity
  } = useNewsEntity({
    entitySlug: props.entitySlug,
  });

  const { shouldLoad } = useLazyTab("news");

  if (!shouldLoad) {
    return null;
  }

  // Gestion des erreurs de chargement d'entité
  if (isErrorEntity) {
    return (
      <section id={id} className="bg-background p-6 sm:p-8 rounded-lg border border-border shadow-sm">
        <div className="text-center py-12 sm:py-16">
          <div className="text-destructive mb-3 sm:mb-4">
            <Calendar className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto" />
          </div>
          <p className="text-lg sm:text-xl font-semibold text-foreground mb-1 sm:mb-2 px-4">
            {t("NewsSection.entityError")}
          </p>
          <p className="text-sm sm:text-base text-muted-foreground px-4">
            {t("NewsSection.entityErrorDescription")}
          </p>
        </div>
      </section>
    );
  }

  return (
    <NewsFeed
      id={id}
      entity={entity}
      entityType={entityType}
      isEntityLoading={isLoadingEntity}
      indexStep={props.maxItems || 12}
      title={props.title}
      showAddButton={props.showAddButton}
      showComments={props.showComments}
      showReactions={props.showReactions}
    />
  );
};

export default NewsSection;
