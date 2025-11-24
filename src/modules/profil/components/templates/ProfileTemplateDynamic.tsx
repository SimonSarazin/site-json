import { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useCocolight } from "@/hooks/useCocolight";
import { useLocalization } from "@/hooks/useLocalization";
import { ProfileSectionRenderer } from "../../ProfileSectionRenderer";
import type { ProfileTab } from "../../schema";
import type { LocalizedString } from "@/types/locale-schema";

// Import direct des composants tab
import { SocialTab } from "../tabs/SocialTab";
import { MembershipTab } from "../tabs/MembershipTab";
import { NewsTab } from "../tabs/NewsTab";

/**
 * Template dynamique de profil avec tabs configurables
 *
 * Ce template remplace ProfileTemplateDefault et utilise la configuration
 * des tabs définie dans le schema JSON au lieu de tabs hardcodés.
 *
 * Les tabs sont filtrés selon:
 * - Le type d'entité (citoyens, organizations, projects, events, poi)
 * - Les permissions de l'utilisateur
 * - Le contexte (own profile vs other profile)
 */
export default function ProfileTemplateDynamic() {
  const { entity, config } = useProfileEntity();
  const { me } = useCocolight();
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentLocale } = useLocalization();

  // Déterminer le tab actif depuis l'URL
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const currentTab = pathSegments.length > 2 ? pathSegments[2] : (config.tabs?.[0]?.id || 'about');

  // Filtrer les tabs selon les conditions
  const availableTabs = useMemo(() => {
    if (!config.tabs || config.tabs.length === 0) {
      return [];
    }

    return config.tabs.filter(tab => {
      if (!tab.condition) return true;

      // Vérifier le type d'entité
      if (tab.condition.entityTypes) {
        const entityType = entity?.getEntityType?.();
        if (entityType && !tab.condition.entityTypes.includes(entityType as any)) {
          return false;
        }
      }

      // Vérifier le contexte utilisateur (own/other)
      if (tab.condition.userContext) {
        const isOwnProfile = me?.slug === entity?.slug;
        if (tab.condition.userContext === "own" && !isOwnProfile) return false;
        if (tab.condition.userContext === "other" && isOwnProfile) return false;
      }

      // TODO: Implémenter la vérification des permissions
      // if (tab.condition.permissions) { ... }

      return true;
    });
  }, [config.tabs, entity, me]);

  // Navigation vers un nouveau tab
  const handleTabChange = (newTab: string) => {
    const tab = availableTabs.find(t => t.id === newTab);
    const path = tab?.path || newTab;

    if (newTab === (config.tabs?.[0]?.id || 'about')) {
      // Premier tab = URL de base
      navigate(`/profil/${slug}`);
    } else {
      navigate(`/profil/${slug}/${path}`);
    }
  };

  // Fonction helper pour obtenir le label localisé
  const getTabLabel = (tab: ProfileTab): string => {
    if (typeof tab.label === "string") {
      return tab.label;
    }
    const localizedLabel = tab.label as LocalizedString;
    return localizedLabel[currentLocale] || localizedLabel.fr || localizedLabel.en || tab.id;
  };

  // Fonction pour rendre un composant tab dédié
  const renderTabComponent = (componentName: string) => {
    switch (componentName) {
      case "SocialTab":
        return <SocialTab />;
      case "MembershipTab":
        return <MembershipTab />;
      case "NewsTab":
        return <NewsTab />;
      default:
        console.warn(`Unknown tab component: ${componentName}`);
        return null;
    }
  };

  // Si pas de tabs configurés, ne rien rendre
  if (!availableTabs || availableTabs.length === 0) {
    return null;
  }

  return (
    <div className="bg-foreground -m-4 md:-m-8">
      <div className="w-full mx-auto bg-background shadow-sm">
        {/* Padding wrapper pour les tabs - Même style que ProfileTemplateDefault ligne 213 */}
        <div className="px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8">
          {/* Tabs dynamiques */}
          <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
            <div className="-mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 overflow-x-auto scrollbar-hide">
              <TabsList className="w-max min-w-full mb-6 sm:mb-8 bg-background border flex rounded-lg">
                {availableTabs.map(tab => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="flex-shrink-0 px-2 sm:px-3 md:px-4 text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-teal-600 data-[state=active]:shadow-sm text-foreground hover:text-foreground"
                  >
                    {getTabLabel(tab)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {availableTabs.map(tab => (
              <TabsContent key={tab.id} value={tab.id}>
                {/* Mode component : rendu direct du composant */}
                {tab.component && renderTabComponent(tab.component)}

                {/* Mode sections : rendu via ProfileSectionRenderer */}
                {tab.sections && tab.sections.map((section, index) => (
                  <ProfileSectionRenderer
                    key={`${tab.id}-${section.type}-${index}`}
                    section={section}
                  />
                ))}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
