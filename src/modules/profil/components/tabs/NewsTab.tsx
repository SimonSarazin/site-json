import { Calendar, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useLazyTab } from "@/hooks/useLazyTab";
import { useProfilNewsQuery } from "../../hooks/useProfilNewsQuery";
import { useProfileMutations } from "../../hooks/useProfileMutations";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { Button } from "@/components/ui/button";
import "@/modules/profil/i18n";
import { NewsItem } from "../news/NewsItem";
import { AddNewsModal } from "../news/AddNewsModal";

export function NewsTab() {
  const { entity, entityType } = useProfileEntity();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  const { canEdit } = useProfileMutations();

  const { shouldLoad } = useLazyTab("news");
  const [showAddNewsModal, setShowAddNewsModal] = useState(false);

  const {
    news,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
  } = useProfilNewsQuery({
    entity,
    entityType,
    enabled: shouldLoad,
    indexStep: 12,
  });

  if (!shouldLoad) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="bg-background p-6 sm:p-8 rounded-lg border border-border shadow-sm">
        <div className="text-center py-12 sm:py-16">
          <div className="animate-pulse space-y-3 sm:space-y-4">
            <div className="h-10 w-10 sm:h-12 sm:w-12 bg-muted rounded-full mx-auto"></div>
            <div className="h-3 sm:h-4 bg-muted rounded w-1/2 mx-auto"></div>
            <div className="h-2 sm:h-3 bg-muted rounded w-1/3 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!news || news.length === 0) {
    return (
      <div className="bg-background p-6 sm:p-8 rounded-lg border border-border shadow-sm">
        <div className="text-center py-12 sm:py-16">
          <div className="text-muted-foreground mb-3 sm:mb-4">
            <Calendar className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto" />
          </div>
          <p className="text-lg sm:text-xl font-semibold text-foreground mb-1 sm:mb-2 px-4">
            {t("NewsTab.noNews")}
          </p>
          <p className="text-sm sm:text-base text-muted-foreground px-4">{t("NewsTab.noNewsDescription")}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 sm:space-y-6">
        {canEdit && (
          <div className="flex justify-end">
            <Button
              onClick={() => setShowAddNewsModal(true)}
              className="bg-primary hover:bg-primary/90 text-xs sm:text-sm text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("NewsTab.createPost")}
            </Button>
          </div>
        )}

        {news.map((item, index) => (
        <NewsItem
          key={item.id}
          item={item}
          entity={entity}
          isLastItem={index === news.length - 1}
          lastItemRef={lastItemRef}
        />
      ))}

      {isFetchingNextPage && (
        <div className="bg-background p-8 rounded-xl border border-border shadow-sm">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground mt-3 font-medium">
              {t("NewsTab.loadingNews")}
            </p>
          </div>
        </div>
        )}

        {!hasNextPage && news.length > 0 && (
          <div className="bg-background p-6 sm:p-8 rounded-xl border border-border shadow-sm">
            <div className="text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <p className="text-sm sm:text-base text-foreground font-semibold mb-1">
                {t("NewsTab.upToDate")}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t("NewsTab.allNewsSeen")}
              </p>
            </div>
          </div>
        )}
      </div>

      {showAddNewsModal && entity && (
        <AddNewsModal
          entity={entity}
          open={showAddNewsModal}
          onOpenChange={setShowAddNewsModal}
        />
      )}
    </>
  );
}
