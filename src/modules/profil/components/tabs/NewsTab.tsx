import { Calendar, Loader2 } from "lucide-react";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useLazyTab } from "@/hooks/useLazyTab";
import { useProfilNewsQuery } from "../../hooks/useProfilNewsQuery";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import "@/modules/profil/i18n";

/**
 * Onglet des actualités d'un profil avec lazy loading et infinite scroll
 *
 * Le tab actif est détecté automatiquement depuis l'URL via useLazyTab
 */
export function NewsTab() {
  const { entity, entityType } = useProfileEntity();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");

  // ✅ shouldLoad = true seulement si l'onglet a été visité (détection automatique via URL)
  const { shouldLoad } = useLazyTab("news");

  // ✅ Infinite scroll avec pagination timestamp-based
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

  // Si pas encore visité, ne rien afficher (LazyTabContent gère déjà ça, mais par sécurité)
  if (!shouldLoad) {
    return null;
  }

  // Pendant le chargement
  if (isLoading) {
    return (
      <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
        <div className="text-center py-16">
          <div className="animate-pulse space-y-4">
            <div className="h-12 w-12 bg-gray-200 rounded-full mx-auto"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
            <div className="h-3 bg-gray-200 rounded w-1/3 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  // Si pas de news (pour l'instant c'est le cas car mock vide)
  if (!news || news.length === 0) {
    return (
      <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
        <div className="text-center py-16">
          <div className="text-gray-400 mb-4">
            <Calendar className="w-16 h-16 mx-auto" />
          </div>
          <p className="text-xl font-semibold text-gray-700 mb-2">
            {t("ProfileTemplateDefault.sectionLabel", undefined, {
              name: t("ProfileTemplateDefault.tabs.news")
            })}
          </p>
          <p className="text-gray-500">{t("ProfileTemplateDefault.comingSoon")}</p>
        </div>
      </div>
    );
  }

  // Afficher les news avec infinite scroll
  return (
    <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
      <h2 className="text-2xl font-bold mb-4">News</h2>
      <div className="space-y-4">
        {news.map((item, index) => {
          const isLastItem = index === news.length - 1;

          return (
            <div
              key={item.id}
              ref={isLastItem ? lastItemRef : undefined}
              className="p-4 border border-gray-100 rounded-lg hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-2">
                    {new Date(item.serverData.date).toLocaleDateString()}
                  </p>
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: item.serverData.text
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Loading indicator pour la pagination */}
      {isFetchingNextPage && (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          <p className="text-sm text-gray-500 mt-2">Chargement...</p>
        </div>
      )}

      {/* Message de fin */}
      {!hasNextPage && news.length > 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500">
            Vous avez vu toutes les actualités
          </p>
        </div>
      )}
    </div>
  );
}
