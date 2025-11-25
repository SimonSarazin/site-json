import { useState } from "react";
import { Plus, Filter, Calendar } from "lucide-react";
import { useT } from "@/hooks/useT";
import { useCocolight } from "@/hooks/useCocolight";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  NewsItem,
  AddNewsModal,
  useNewsQuery,
  NewsProvider,
  type NewsPermissions
} from "@/modules/news";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import "@/modules/news/i18n";

/**
 * Page principale du module News
 * Affiche toutes les actualités publiques avec possibilité de filtrer
 */
export function NewsPage() {
  useLoadNamespace("modules/news");
  const t = useT("modules/news");
  const { me } = useCocolight();
  const [showAddNewsModal, setShowAddNewsModal] = useState(false);

  // Pour cette page globale, on utilise l'utilisateur connecté comme entité
  const entity = me;

  // Permissions pour la page globale news
  const permissions: NewsPermissions = {
    canAdd: !!me?.isConnected,
    canEdit: false, // Chacun peut modifier ses propres news dans NewsItem
    canDelete: false, // Chacun peut supprimer ses propres news dans NewsItem
    canModerate: me?.serverData?.roles?.admin === true,
    canComment: !!me?.isConnected,
    canReact: !!me?.isConnected,
    canShare: !!me?.isConnected,
    canReport: !!me?.isConnected,
  };

  const {
    news,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
  } = useNewsQuery({
    entity: me!,
    entityType: (me!.serverData?.type as string) || "citoyens",
    enabled: true,
    indexStep: 15,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-background p-6 sm:p-8 rounded-lg border border-border shadow-sm">
            <div className="text-center py-12 sm:py-16">
              <div className="animate-pulse space-y-3 sm:space-y-4">
                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-muted rounded-full mx-auto"></div>
                <div className="h-3 sm:h-4 bg-muted rounded w-1/2 mx-auto"></div>
                <div className="h-2 sm:h-3 bg-muted rounded w-1/3 mx-auto"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">Erreur</CardTitle>
              <CardDescription>
                Une erreur est survenue lors du chargement des actualités
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <NewsProvider value={{
      entity,
      permissions,
      entityId: entity?.id || undefined,
      entityType: "global"
    }}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* En-tête */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Actualités
            </h1>
            <p className="text-muted-foreground mb-6">
              Découvrez les dernières actualités de la communauté
            </p>

            <div className="flex gap-4 justify-between items-center">
              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Filtrer
                </Button>
              </div>

              {/* Bouton d'ajout */}
              {permissions.canAdd && (
                <Button
                  onClick={() => setShowAddNewsModal(true)}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t("NewsTab.createPost")}
                </Button>
              )}
            </div>
          </div>

          {/* Liste des actualités */}
          {!news || news.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="text-muted-foreground mb-4">
                  <Calendar className="w-16 h-16 mx-auto" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {t("NewsTab.noNews")}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {t("NewsTab.noNewsDescription")}
                </p>
                {permissions.canAdd && (
                  <Button
                    onClick={() => setShowAddNewsModal(true)}
                    variant="outline"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t("NewsTab.createPost")}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {news.map((item, index) => (
                <NewsItem
                  key={item.id}
                  item={item}
                  entity={entity || undefined}
                  isLastItem={index === news.length - 1}
                  lastItemRef={lastItemRef}
                />
              ))}

              {/* Indicateur de chargement */}
              {isFetchingNextPage && (
                <Card>
                  <CardContent className="text-center py-8">
                    <div className="animate-pulse">
                      <div className="h-4 bg-muted rounded w-1/3 mx-auto"></div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Fin de la liste */}
              {!hasNextPage && news.length > 0 && (
                <Card>
                  <CardContent className="text-center py-6">
                    <div className="text-muted-foreground">
                      <Calendar className="w-8 h-8 mx-auto mb-2" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("NewsTab.upToDate")}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Modal d'ajout d'actualité */}
          {showAddNewsModal && entity && (
            <AddNewsModal
              entity={entity}
              open={showAddNewsModal}
              onOpenChange={setShowAddNewsModal}
            />
          )}
        </div>
      </div>
    </NewsProvider>
  );
}