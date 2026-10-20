import { useMemo, Suspense, useEffect } from "react";
import { lazy } from "vite-preload";
import { useHydrated } from "@/hooks/useHydrated";
import { useLocation, useNavigate, useParams } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useCocolight } from "@/hooks/useCocolight";
import { ProfileSectionRenderer } from "../../ProfileSectionRenderer";
import { TabDetailRenderer } from "../TabDetailRenderer";

// Tabs en lazy() : à un profil donné, l'utilisateur ne consulte qu'un tab
// à la fois. Les autres ne sont téléchargés qu'au clic.
const SocialTab = lazy(() => import("../tabs/SocialTab"));
const MembershipTab = lazy(() => import("../tabs/MembershipTab"));
import type { MembershipTabProps } from "../tabs/MembershipTab";
const NewsTab = lazy(() => import("../tabs/NewsTab"));
const StructuresTab = lazy(() => import("../tabs/StructuresTab"));
import { useLocalization } from "@/hooks/useLocalization";
import { StructuresTabPropsSchema } from "../../schema";
import { isTabVisible } from "../../lib/tabVisibility";

/**
 * Template dynamique de profil avec tabs configurables
 *
 * Ce template remplace ProfileTemplateDefault et utilise la configuration
 * des tabs définie dans le schema JSON au lieu de tabs hardcodés.
 *
 * Les tabs sont filtrés selon leur `condition` (cf. `isTabVisible`) :
 * - le type d'entité (citoyens, organizations, projects, events, poi) ;
 * - le contexte (son propre profil ou celui d'un autre) et l'authentification, tranchés après
 *   l'hydratation. `permissions` est déclaré au schéma mais pas encore implémenté.
 */
export default function ProfileTemplateDynamic() {
  const { entity, config } = useProfileEntity();
  const { me } = useCocolight();
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLocalization();
  
  // Déterminer le tab actif depuis l'URL et si on est sur une sous-route
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const currentTab = pathSegments.length > 2 ? pathSegments[2] : (config.tabs?.[0]?.id || 'about');
  const isSubRoute = pathSegments.length > 3; // /profil/:slug/:tab/:subRoute...

  // `hydrated` reste à `false` pendant le SSR et le 1er render client : les conditions qui dépendent
  // de `me` n'y sont pas tranchées (identique HTML SSR/client → pas de mismatch), cf. `isTabVisible`.
  const hydrated = useHydrated();

  // Filtrer les tabs selon les conditions (`permissions` : déclaré au schéma, pas encore implémenté).
  const availableTabs = useMemo(() => {
    if (!config.tabs || config.tabs.length === 0) {
      return [];
    }
    const contexte = { entityType: entity?.getEntityType?.(), hydrated, me, entitySlug: entity?.slug };
    return config.tabs.filter((tab) => isTabVisible(tab.condition, contexte));
  }, [config.tabs, entity, me, hydrated]);

  // Garde-fou URL directe : si on arrive sur `/profil/x/finance` en anonyme alors
  // que la tab a été filtrée, on redirige vers le tab par défaut. Indispensable
  // car les routes générées par `generateTabRoutes` ne sont pas filtrées par auth
  // (le router est figé après le boot — cf. entry-client.tsx).
  useEffect(() => {
    if (!hydrated) return;
    if (availableTabs.length === 0) return;
    if (!availableTabs.find(t => t.id === currentTab)) {
      navigate(`/profil/${slug}`, { replace: true });
    }
  }, [hydrated, currentTab, availableTabs, slug, navigate]);

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

  // Fonction pour rendre un composant tab dédié. `props` vient de la config de l'onglet — c'est
  // l'équivalent, pour le mode `component`, des `props` que porte chaque section du mode `sections`.
  const renderTabComponent = (componentName: string, props?: Record<string, unknown>) => {
    switch (componentName) {
      case "SocialTab":
        return <SocialTab />;
      case "MembershipTab":
        return <MembershipTab {...(props as MembershipTabProps | undefined)} />;
      case "NewsTab":
        return <NewsTab />;
      case "StructuresTab": {
        // La config n'est jamais parsée par Zod au runtime : on revalide ici (coût nul) plutôt que de
        // caster — un formulaire mal déclaré ne rend rien au lieu d'interroger le serveur à vide.
        const parsed = StructuresTabPropsSchema.safeParse(props);
        if (!parsed.success) {
          console.warn("StructuresTab : props invalides", parsed.error.issues);
          return null;
        }
        return <StructuresTab {...parsed.data} />;
      }
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
    // Pas de marge négative ici : ce template est monté directement sous <main>
    // (layout `full-width`, aucun padding parent). Un `-m-8` déborderait de 2rem
    // de chaque côté à partir de `lg` → scroll horizontal au niveau page.
    <div className="bg-foreground">
      <div className="w-full mx-auto bg-background">
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
                    className="shrink-0 px-2 sm:px-3 md:px-4 text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm text-foreground hover:text-foreground"
                  >
                    {t(tab.label)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {availableTabs.map(tab => (
              <TabsContent key={tab.id} value={tab.id}>
                {/* Si on est sur une sous-route, rendre TabDetailRenderer */}
                {isSubRoute && tab.subRoutes && tab.subRoutes.length > 0 ? (
                  <Suspense fallback={
                    <div className="p-8 text-center">
                      <div className="animate-pulse space-y-4">
                        <div className="h-6 bg-muted rounded w-3/4 mx-auto"></div>
                        <div className="h-4 bg-muted rounded w-1/2 mx-auto"></div>
                        <div className="space-y-2">
                          <div className="h-4 bg-muted rounded"></div>
                          <div className="h-4 bg-muted rounded"></div>
                          <div className="h-4 bg-muted rounded w-2/3"></div>
                        </div>
                      </div>
                    </div>
                  }>
                    <TabDetailRenderer tabId={tab.id} />
                  </Suspense>
                ) : (
                  <>
                    {/* Mode component : rendu direct du composant. Suspense LOCAL : l'onglet est un
                        chunk `lazy()` — sans lui, son chargement suspendait jusqu'à la frontière du
                        profil, qui disparaissait derrière un spinner (cas d'un lien direct vers un
                        onglet réservé au propriétaire, qui n'apparaît qu'après l'hydratation). */}
                    {tab.component && (
                      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />}>
                        {renderTabComponent(tab.component, tab.props)}
                      </Suspense>
                    )}

                    {/* Mode sections : rendu via ProfileSectionRenderer */}
                    {tab.sections && tab.sections.map((section, index) => (
                      <ProfileSectionRenderer
                        key={`${tab.id}-${section.type}-${index}`}
                        section={section}
                      />
                    ))}
                  </>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
