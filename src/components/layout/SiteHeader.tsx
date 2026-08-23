import { useSite } from "@/hooks/useSite";
import { useLocation } from "react-router";
import { lazy } from "vite-preload";
import { isHeroSectionType } from "./header/useHeaderBehavior";

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

export function SiteHeader() {
  const { config } = useSite();
  const { pathname } = useLocation();
  const header = config.header;

  // La page config courante débute-t-elle par un héro ? (route module sans page
  // config — ex. /profil/:slug — → false). Sert au mode `transparentMode: "auto"`.
  const currentPage = config.pages.find((p) => p.path === pathname);
  const pageHasHero = isHeroSectionType(currentPage?.sections?.[0]?.type);

  switch (header?.type) {
    case "mega-menu":
      return <HeaderMegaMenu header={header} />;
    case "transparent-scroll":
      return <HeaderTransparentScroll header={header} pageHasHero={pageHasHero} />;
    case "minimal":
      return <HeaderMinimal header={header} />;
    case "underline-nav":
      return <HeaderUnderlineNav header={header} />;
    case "transparent-dark":
      return <HeaderTransparentDark header={header} />;
    case "standard":
      return <HeaderStandard header={header} />;
    case "stacked":
      return <HeaderStacked header={header} />;
    case "default":
    default:
      return <DefaultHeader header={header} />;
  }
}
