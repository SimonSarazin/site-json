import { useSite } from "@/hooks/useSite";
import { useLocation } from "react-router";
import { lazy } from "vite-preload";
import { isHeroSectionType } from "./header/useHeaderBehavior";
import { useResolveDynamicNav } from "./header/useResolveDynamicNav";
import type { EnhancedNavItemType } from "@/types/site-schema";

/**
 * Headers en `lazy()` : à un site donné, on n'utilise qu'UN seul type de
 * header. Le chunk du header non utilisé n'est donc pas téléchargé côté
 * client. Côté SSR, `preloadAll()` charge tous les modules en mémoire Node
 * (pas d'impact perf SSR).
 */
const DefaultHeader = lazy(() => import("./header/DefaultHeader"));
const HeaderStandard = lazy(() => import("./header/HeaderStandard"));
const HeaderMegaMenu = lazy(() => import("./header/HeaderMegaMenu"));
const HeaderUnderlineNav = lazy(() => import("./header/HeaderUnderlineNav"));
const HeaderTransparentDark = lazy(() => import("./header/HeaderTransparentDark"));
const HeaderTransparentScroll = lazy(() => import("./header/HeaderTransparentScroll"));
const HeaderMinimal = lazy(() => import("./header/HeaderMinimal"));
const HeaderStacked = lazy(() => import("./header/HeaderStacked"));

// Référence STABLE : un littéral `[]` inline serait un tableau NEUF à chaque rendu, ce qui
// invaliderait en boucle le `useMemo` de `useResolveDynamicNav` sur tout site sans header
// (même piège que `AUCUNE_LISTE` dans `useCostumLists.tsx`).
const EMPTY_NAV: EnhancedNavItemType[] = [];

export function SiteHeader() {
  const { config } = useSite();
  const { pathname } = useLocation();
  const header = config.header;

  // La page config courante débute-t-elle par un héro ? (route module sans page
  // config — ex. /profil/:slug — → false). Sert au mode `transparentMode: "auto"`.
  const currentPage = config.pages.find((p) => p.path === pathname);
  const pageHasHero = isHeroSectionType(currentPage?.sections?.[0]?.type);

  // Résout les items `nav[].dynamicList` (costum.lists.<nom> → children) une seule fois,
  // avant dispatch vers la variante de header choisie — aucune variante n'a besoin de
  // connaître ce mécanisme, cf. `useResolveDynamicNav`.
  const resolvedNav = useResolveDynamicNav(header?.nav ?? EMPTY_NAV, config);
  const resolvedHeader = header ? { ...header, nav: resolvedNav } : header;

  switch (resolvedHeader?.type) {
    case "mega-menu":
      return <HeaderMegaMenu header={resolvedHeader} />;
    case "transparent-scroll":
      return <HeaderTransparentScroll header={resolvedHeader} pageHasHero={pageHasHero} />;
    case "minimal":
      return <HeaderMinimal header={resolvedHeader} />;
    case "underline-nav":
      return <HeaderUnderlineNav header={resolvedHeader} />;
    case "transparent-dark":
      return <HeaderTransparentDark header={resolvedHeader} />;
    case "standard":
      return <HeaderStandard header={resolvedHeader} />;
    case "stacked":
      return <HeaderStacked header={resolvedHeader} />;
    case "default":
    default:
      return <DefaultHeader header={resolvedHeader} />;
  }
}
