import { ArrowLeft, Calendar } from "lucide-react";
import { useNavigate } from "react-router";
import { useState } from "react";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { Button } from "@/components/ui/button";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useNewsByIdQuery } from "../hooks/useNewsByIdQuery";
import { useDeleteNews } from "../hooks/useNewsMutations";
import { NewsItem } from "./NewsItem";
import { ShareNewsDialog } from "./ShareNewsDialog";
import { ReportDialog } from "./ReportDialog";
import { EditNewsModal } from "./forms/EditNewsModal";
import { DeleteNewsDialog } from "./DeleteNewsDialog";
import { useNewsPermissions } from "../hooks/useNewsPermissions";
import type { NewsSection } from "../schema";
import type { News } from "@communecter/cocolight-api-client";
import "../i18n";
import { NewsProvider } from "../contexts/NewsProvider";

interface NewsDetailPageProps {
  params: Record<string, string | undefined>;
  entity: EntityTypes;
  sectionProps?: NewsSection["props"]; // Configuration de la section parente
}

export const NewsDetailPage = ({ params, entity, sectionProps }: NewsDetailPageProps) => {
  useLoadNamespace("modules/news");
  const t = useT("modules/news");
  const navigate = useNavigate();

  const { newsId } = params;
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const permissions = useNewsPermissions(entity);

  // Mutation pour la suppression (conditionné sur l'existence de l'entité)
  const deleteNewsMutation = useDeleteNews(entity, { optimistic: true });

  // Configuration par défaut si pas de sectionProps
  const props = sectionProps || {
    showAddButton: false, // Pas d'ajout en mode détail
    showComments: true,
    showReactions: true,
    maxItems: 10,
  };

  const {
    data: news,
    isLoading,
    isError,
    error
  } = useNewsByIdQuery({
    newsId: newsId!,
    entity,
    enabled: !!newsId
  });

  const handleBack = () => {
    navigate(-1);
  };

  const handleShare = () => {
    setShareDialogOpen(true);
  };

  const handleReport = () => {
    setReportDialogOpen(true);
  };

  const handleEdit = (_newsItem: News) => {
    setEditModalOpen(true);
  };

  const handleDelete = (_newsItem: News) => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (news && deleteNewsMutation) {
      deleteNewsMutation.mutate(
        { news },
        {
          onSuccess: () => {
            setDeleteDialogOpen(false);
            // Naviguer vers la liste des news après suppression
            navigate(`/profil/${entity.slug}/news`);
          },
        }
      );
    }
  };

  if (!newsId) {
    return (
      <div className="p-6 text-center">
        <p className="text-destructive">{t("NewsDetailPage.invalidNewsId")}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("NewsDetailPage.back")}
          </Button>
        </div>

        <div className="bg-background p-8 rounded-xl border border-border shadow-sm">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded"></div>
              <div className="h-4 bg-muted rounded"></div>
              <div className="h-4 bg-muted rounded w-2/3"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !news) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("NewsDetailPage.back")}
          </Button>
        </div>

        <div className="bg-background p-8 rounded-xl border border-border shadow-sm">
          <div className="text-center py-12">
            <div className="text-destructive mb-4">
              <Calendar className="w-16 h-16 mx-auto" />
            </div>
            <p className="text-xl font-semibold text-foreground mb-2">
              {t("NewsDetailPage.newsNotFound")}
            </p>
            <p className="text-muted-foreground">
              {t("NewsDetailPage.newsNotFoundDescription")}
            </p>
            {error && (
              <p className="text-sm text-destructive mt-2">
                {error.message}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const newsPermissions = {
    canAdd: false, // Pas d'ajout en mode détail
    canEdit: permissions.canEditNews, // Basé sur les vraies permissions
    canDelete: permissions.canDeleteNews, // Basé sur les vraies permissions
    canModerate: permissions.canModerateNews,
    canComment: (props.showComments ?? true) && permissions.canEditComment,
    canReact: (props.showReactions ?? true),
    canShare: true,
    canReport: true,
  };

  return (
    <NewsProvider value={{
      entity,
      permissions: newsPermissions,
      entityId: entity?.id || undefined,
      entityType: entity?.serverData?.type
    }}>
      <div className="space-y-6">
        {/* Header avec navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("NewsDetailPage.back")}
          </Button>
        </div>

        {/* Contenu détaillé de la news */}
        <div className="bg-background rounded-xl border border-border shadow-sm overflow-hidden">
          <NewsItem
            item={news}
            entity={entity}
            isLastItem={false}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onShare={handleShare}
            onReport={handleReport}
            detailMode={true} // Mode détail pour affichage complet
          />
        </div>

        {/* Dialogs */}
        <ShareNewsDialog
          entity={entity}
          news={news}
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
        />

        <ReportDialog
          type="news"
          item={news}
          open={reportDialogOpen}
          onOpenChange={setReportDialogOpen}
        />

        {/* Modals d'édition et suppression */}
        <EditNewsModal
          entity={entity}
          news={news}
          open={editModalOpen}
          onOpenChange={(open) => {
            setEditModalOpen(open);
          }}
        />

        <DeleteNewsDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDelete}
          isPending={deleteNewsMutation?.isPending || false}
        />
      </div>
    </NewsProvider>
  );
};

export default NewsDetailPage;