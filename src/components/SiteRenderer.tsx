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
// import { SiteHeader2 } from "./layout/SiteHeader2";

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

  const currentPage =
    config.pages.find((p) => p.path === pathname) || config.pages[0];

  usePageGuards(currentPage);

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
              {currentPage.sections.map((s, i) => (
                <SectionRenderer key={s.id ?? `section-${i}`} section={s} index={i} />
              ))}
            </PageProvider>
          </PageProvidersComposer>
        </main>

        {!currentPage.hideFooter && <SiteFooter />}
      </div>
    </>
  );
}
