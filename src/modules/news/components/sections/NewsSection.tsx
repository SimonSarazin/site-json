import { Calendar, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useNewsPermissions } from "../../hooks/useNewsPermissions";
import { Button } from "@/components/ui/button";
import { useLazyTab } from "@/hooks/useLazyTab";
import type { NewsSection as NewsSectionType } from "../../schema";
import { NewsItem } from "../NewsItem";
import { AddNewsModal } from "../forms/AddNewsModal";
import { EditNewsModal } from "../forms/EditNewsModal";
import { DeleteNewsDialog } from "../DeleteNewsDialog";
import { ShareNewsDialog } from "../ShareNewsDialog";
import { ReportDialog } from "../ReportDialog";
import { useDeleteNews } from "../../hooks/useNewsMutations";
import type { News } from "@communecter/cocolight-api-client";
import { useNewsQuery } from "../../hooks/useNewsQuery";
import { useNewsEntity } from "../../hooks/useNewsEntity";
import { useNewsDetailUrlGenerator } from "@/modules/profil/hooks/useNewsDetailUrlGenerator";
import "../../i18n";
import { NewsProvider } from "../../contexts/NewsProvider";

interface NewsSectionProps {
  id?: string;
  props: NewsSectionType["props"];
}

export const NewsSection = ({ id, props }: NewsSectionProps) => {
  useLoadNamespace("modules/news");
  const t = useT("modules/news");

  const [showAddNewsModal, setShowAddNewsModal] = useState(false);

  // État pour gérer les modaux et la news sélectionnée
  const [selectedNews, setSelectedNews] = useState<News | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  // Résoudre l'entité avec la logique propre
  const {
    entity,
    entityType,
    isLoading: isLoadingEntity,
    isError: isErrorEntity
  } = useNewsEntity({
    entitySlug: props.entitySlug,
  });

  const permissions = useNewsPermissions(entity);

  const { shouldLoad } = useLazyTab("news");

  // Hook pour générer les URLs de détail des news
  const detailUrlGenerator = useNewsDetailUrlGenerator(entity);

  // Mutation pour la suppression (hook appelé inconditionnellement pour respecter Rules of Hooks)
  const deleteNewsMutation = useDeleteNews(entity, { optimistic: true });

  const {
    news,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
  } = useNewsQuery({
    entity: entity,
    entityType: entityType,
    enabled: shouldLoad,
    indexStep: props.maxItems || 12,
  });

  // Handlers pour les actions des modaux
  const handleEdit = (news: News) => {
    setSelectedNews(news);
    setEditModalOpen(true);
  };

  const handleDelete = (news: News) => {
    setSelectedNews(news);
    setDeleteDialogOpen(true);
  };

  const handleShare = (news: News) => {
    setSelectedNews(news);
    setShareDialogOpen(true);
  };

  const handleReport = (news: News) => {
    setSelectedNews(news);
    setReportDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedNews && entity) {
      deleteNewsMutation.mutate(
        { news: selectedNews },
        {
          onSuccess: () => {
            setDeleteDialogOpen(false);
            setSelectedNews(null);
          },
        }
      );
    }
  };

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

  if (isLoadingEntity || isLoading) {
    return (
      <section id={id} className="bg-background p-6 sm:p-8 rounded-lg border border-border shadow-sm">
        {props.title && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground">
              {typeof props.title === "string" ? props.title : t(props.title)}
            </h2>
          </div>
        )}
        <div className="text-center py-12 sm:py-16">
          <div className="animate-pulse space-y-3 sm:space-y-4">
            <div className="h-10 w-10 sm:h-12 sm:w-12 bg-muted rounded-full mx-auto"></div>
            <div className="h-3 sm:h-4 bg-muted rounded w-1/2 mx-auto"></div>
            <div className="h-2 sm:h-3 bg-muted rounded w-1/3 mx-auto"></div>
          </div>
        </div>
      </section>
    );
  }

  if (!news || news.length === 0) {
    return (
      <>
        <section id={id} className="bg-background p-6 sm:p-8 rounded-lg border border-border shadow-sm">
          {props.title && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground">
                {typeof props.title === "string" ? props.title : t(props.title)}
              </h2>
            </div>
          )}
          <div className="text-center py-12 sm:py-16">
            <div className="text-muted-foreground mb-3 sm:mb-4">
              <Calendar className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto" />
            </div>
            <p className="text-lg sm:text-xl font-semibold text-foreground mb-1 sm:mb-2 px-4">
              {t("NewsSection.noNews")}
            </p>
            <p className="text-sm sm:text-base text-muted-foreground px-4 mb-4">
              {t("NewsSection.noNewsDescription")}
            </p>
            {permissions.canAddNews && (props.showAddButton ?? true) && (
              <Button
                onClick={() => setShowAddNewsModal(true)}
                className="bg-primary hover:bg-primary/90 text-xs sm:text-sm text-primary-foreground"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("NewsSection.createPost")}
              </Button>
            )}
          </div>
        </section>

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

  const newsPermissions = {
    canAdd: permissions.canAddNews && (props.showAddButton ?? true),
    canEdit: false,
    canDelete: false,
    canModerate: permissions.canModerateNews,
    canComment: (props.showComments ?? true) && permissions.canEditComment,
    canReact: (props.showReactions ?? true),
    canShare: true,
    canReport: true,
  };


  return (
    <NewsProvider value={{
      entity: entity || undefined,
      permissions: newsPermissions,
      entityId: entity?.id || undefined,
      entityType: entity?.getEntityType?.(),
      detailUrlGenerator: detailUrlGenerator || undefined
    }}>
      <section id={id} className="space-y-4 sm:space-y-6">
        {props.title && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground">
              {typeof props.title === "string" ? props.title : t(props.title)}
            </h2>
          </div>
        )}

        {permissions.canAddNews && (props.showAddButton ?? true) && (
          <div className="flex justify-end">
            <Button
              onClick={() => setShowAddNewsModal(true)}
              className="bg-primary hover:bg-primary/90 text-xs sm:text-sm text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("NewsSection.createPost")}
            </Button>
          </div>
        )}

        {news.map((item, index) => (
          <NewsItem
            key={item.id}
            item={item}
            entity={entity || undefined}
            isLastItem={index === news.length - 1}
            lastItemRef={lastItemRef}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onShare={handleShare}
            onReport={handleReport}
          />
        ))}

        {isFetchingNextPage && (
          <div className="bg-background p-8 rounded-xl border border-border shadow-sm">
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground mt-3 font-medium">
                {t("NewsSection.loadingNews")}
              </p>
            </div>
          </div>
        )}

        {!hasNextPage && news.length > 0 && (
          <div className="bg-background p-6 sm:p-8 rounded-xl border border-border shadow-sm">
            <div className="text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-primary dark:text-primary" />
              </div>
              <p className="text-sm sm:text-base text-foreground font-semibold mb-1">
                {t("NewsSection.upToDate")}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t("NewsSection.allNewsSeen")}
              </p>
            </div>
          </div>
        )}
      </section>

      {showAddNewsModal && entity && (
        <AddNewsModal
          entity={entity}
          open={showAddNewsModal}
          onOpenChange={setShowAddNewsModal}
        />
      )}

      {selectedNews && entity && (
        <>
          <EditNewsModal
            entity={entity}
            news={selectedNews}
            open={editModalOpen}
            onOpenChange={(open) => {
              setEditModalOpen(open);
              if (!open) setSelectedNews(null);
            }}
          />

          <DeleteNewsDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) setSelectedNews(null);
            }}
            onConfirm={confirmDelete}
            isPending={deleteNewsMutation.isPending}
          />

          <ShareNewsDialog
            entity={entity}
            news={selectedNews}
            open={shareDialogOpen}
            onOpenChange={(open) => {
              setShareDialogOpen(open);
              if (!open) setSelectedNews(null);
            }}
          />

          <ReportDialog
            type="news"
            item={selectedNews}
            open={reportDialogOpen}
            onOpenChange={(open) => {
              setReportDialogOpen(open);
              if (!open) setSelectedNews(null);
            }}
          />
        </>
      )}
    </NewsProvider>
  );
};

export default NewsSection;
