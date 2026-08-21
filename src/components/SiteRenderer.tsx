// src/SiteRenderer.tsx
import { useMemo, type ReactNode } from "react";
import { useLocation } from "react-router";
import { SiteHeader } from "./layout/SiteHeader";
import { SiteFooter } from "./layout/SiteFooter";
import { SectionRenderer } from "./sections/SectionRenderer";
import { useSite } from "@/hooks/useSite";
import { Seo } from "./layout/Seo";
import { usePageGuards } from "@/hooks/usePageGuards";
import { PageProvider } from "@/contexts/PageProvider";
import { discoverModules, getPageProviders } from "@/lib/modules";
import { evaluatePageAccess } from "@/lib/pageAccess";
import { GatedPageNotice } from "@/modules/auth/components/GatedPageNotice";
import { useCocolight } from "@/hooks/useCocolight";
import { useHydrated } from "@/hooks/useHydrated";

/**
 * Compose la liste des `PageProvider` des modules autour de `children`.
 * L'ordre est celui de découverte (`discoverModules`). Si un module B a besoin
 * de lire le context d'un module A, il faudra introduire un champ `priority`
 * — pas implémenté car aucun cas d'usage à ce jour.
 */
function PageProvidersComposer({ children }: { children: ReactNode }) {
  const Providers = useMemo(() => getPageProviders(discoverModules()), []);
  return Providers.reduceRight<ReactNode>(
    (acc, Provider) => <Provider>{acc}</Provider>,
    children
  ) as React.ReactElement;
}

export function SiteRenderer() {
  const { config } = useSite();
  const { pathname } = useLocation();
  const { me } = useCocolight();
  const hydrated = useHydrated();

  const currentPage =
    config.pages.find((p) => p.path === pathname) || config.pages[0];

  usePageGuards(currentPage);

  /**
   * Une page GARDÉE ne sert ses sections qu'une fois l'accès établi CÔTÉ CLIENT.
   *
   * `usePageGuards` vit dans un `useEffect` : il ne s'exécute jamais au rendu serveur. Sans ce
   * verrou, le HTML complet d'une page réservée partait en HTTP 200 à un visiteur anonyme
   * (mesuré : 165 ko, 5 sections, ~1 s de contenu privé à l'écran avant la redirection), lisible
   * en `view-source` et par tout client qui n'exécute pas JS.
   *
   * Ce n'est PAS une garde serveur — elle est aujourd'hui impossible (`initApi()` n'est pas
   * appelé avec les cookies de la requête, et le stockage de jeton au SSR est `"memory"` : `me`
   * vaut toujours `null` au rendu). C'est un verrou de RENDU : le contenu ne quitte plus le
   * serveur. Le sitemap et la balise `robots` appliquent la même règle via `isGatedPage`.
   */
  const acces = evaluatePageAccess(currentPage, me);
  // `hydrated` est décisif : au SSR `me` vaut TOUJOURS `null` (aucun cookie transmis à
  // `initApi`), donc `granted` y serait faux même pour un utilisateur connecté. On ne rend les
  // sections qu'une fois la décision réellement prise côté client.
  const sectionsMasquees = acces.gated && !(hydrated && acces.granted);

  if (!currentPage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">404 – {pathname}</p>
      </div>
    );
  }

  const layout = currentPage.layout;

function getLayoutClasses(layout: string) {
  switch (layout) {
    case "fullwidth":
      return "w-full"; 
    // case "sidebar-left":
    //   return "grid grid-cols-12 gap-8 px-4";
    // case "sidebar-right":
    //   return "grid grid-cols-12 gap-8 px-4";
    case "default":
    default:
      return "w-full sm:max-w-7xl mx-auto";
  }
}

  return (
    <>
      <Seo page={currentPage} />
      <div className={`min-h-screen flex flex-col ${getLayoutClasses(layout)}`}>
        {!currentPage.hideHeader && <SiteHeader />}

         <main id="main" role="main" className="flex-1">
          {/* key={pathname} : remonte les page-providers (PageFilters) à chaque
              changement de page config. Sans ça, React Router réutilise la même
              instance <SiteRenderer/> entre deux pages config (ex. /lieux ↔
              /reseaux-regionaux) et l'état page-scoped (filtres) fuite d'une
              page à l'autre. pathname exclut les query params → filtrer sur la
              même page ne remonte pas. */}
          <PageProvidersComposer key={pathname}>
            <PageProvider page={currentPage}>
              {sectionsMasquees ? (
                <GatedPageNotice
                  mode={acces.mode}
                  reason={acces.reason ?? "anonymous"}
                  resolved={hydrated}
                />
              ) : (
                currentPage.sections.map((s, i) => (
                  <SectionRenderer key={s.id ?? `section-${i}`} section={s} index={i} />
                ))
              )}
            </PageProvider>
          </PageProvidersComposer>
        </main>

        {!currentPage.hideFooter && <SiteFooter />}
      </div>
    </>
  );
}
