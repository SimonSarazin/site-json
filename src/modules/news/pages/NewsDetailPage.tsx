import { useParams, Navigate } from "react-router";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { useCocolight } from "@/hooks/useCocolight";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import {
  NewsItem,
  NewsProvider,
  type NewsPermissions
} from "@/modules/news";

/**
 * Page de détail d'une actualité
 * Affiche une actualité spécifique avec ses commentaires
 */
export function NewsDetailPage() {
  const { id } = useParams<{ id: string }>();
  // const t = useT("modules/news");
  const { me } = useCocolight();

  // Permissions pour la page de détail
  const permissions: NewsPermissions = {
    canAdd: false, // Pas d'ajout sur la page de détail
    canEdit: false, // Chacun peut modifier ses propres news dans NewsItem
    canDelete: false, // Chacun peut supprimer ses propres news dans NewsItem
    canModerate: me?.serverData?.roles?.admin === true,
    canComment: !!me?.isConnected,
    canReact: !!me?.isConnected,
    canShare: !!me?.isConnected,
    canReport: !!me?.isConnected,
  };

  // Query pour récupérer l'actualité spécifique
  // TODO: Implémenter la récupération d'une news par ID
  const {
    data: news,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["news-detail", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Missing news ID");
      }

      // Pour l'instant, on simule une news vide
      // TODO: Implémenter la vraie récupération via l'API
      throw new Error("News detail not implemented yet");
    },
    enabled: false, // Désactivé pour l'instant
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Redirect si pas d'ID
  if (!id) {
    return <Navigate to="/news" replace />;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Bouton retour */}
          <Button
            variant="ghost"
            size="sm"
            className="mb-6"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>

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

  if (error || !news) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Bouton retour */}
          <Button
            variant="ghost"
            size="sm"
            className="mb-6"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <CardTitle className="text-destructive">
                  Actualité non trouvée
                </CardTitle>
              </div>
              <CardDescription>
                Cette actualité n'existe pas ou n'est plus accessible
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => window.history.back()} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // At this point, news should exist but TypeScript doesn't know
  // Since the query is disabled, news will be undefined, so let's handle this case
  if (!news) {
    return <Navigate to="/news" replace />;
  }

  return (
    <NewsProvider value={{
      entity: me || undefined,
      permissions,
      entityId: me?.id || undefined,
      entityType: me?.serverData?.type as string | undefined
    }}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Navigation */}
          <div className="mb-6 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>

            <div className="text-sm text-muted-foreground">
              Actualité #{id}
            </div>
          </div>

          {/* Actualité */}
          <NewsItem
            item={news}
            entity={me || undefined}
          />
        </div>
      </div>
    </NewsProvider>
  );
}