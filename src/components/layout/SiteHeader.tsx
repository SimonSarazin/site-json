import { useSite } from "@/hooks/useSite";
import { lazy } from "vite-preload";

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

export function SiteHeader() {
  const { config } = useSite();
  const header = config.header;

  switch (header?.type) {
    case "mega-menu":
      return <HeaderMegaMenu header={header} />;
    case "transparent-scroll":
      return <HeaderTransparentScroll header={header} />;
    case "minimal":
      return <HeaderMinimal header={header} />;
    case "underline-nav":
      return <HeaderUnderlineNav header={header} />;
    case "transparent-dark":
      return <HeaderTransparentDark header={header} />;
    case "standard":
      return <HeaderStandard header={header} />;
    case "default":
    default:
      return <DefaultHeader header={header} />;
  }
}
