import { useSite } from "@/hooks/useSite";
import { lazy } from "vite-preload";

/**
 * Headers en `lazy()` : à un site donné, on n'utilise qu'UN seul type de
 * header. Le chunk du header non utilisé n'est donc pas téléchargé côté
 * client. Côté SSR, `preloadAll()` charge tous les modules en mémoire Node
 * (pas d'impact perf SSR).
 */
const DefaultHeader = lazy(() => import("./header/DefaultHeader"));
const HeaderTiersLieux = lazy(() => import("./header/HeaderTiersLieux"));
const HeaderNosCommunes = lazy(() => import("./header/HeaderNosCommunes"));
const HeaderCommuneTransparente = lazy(() => import("./header/HeaderCommuneTransparente"));
const HeaderRezoLaMer = lazy(() => import("./header/HeaderRezoLaMer"));
const HeaderJuliePotVin = lazy(() => import("./header/HeaderJuliePotVin"));

export function SiteHeader() {
  const { config } = useSite();
  const header = config.header;

  switch (header?.type) {
    case "tiers-lieux":
      return <HeaderTiersLieux header={header} />;
    case "rezo-la-mer":
    case "cyber-reunion":
      return <HeaderRezoLaMer header={header} />;
    case "julie-pot-vin":
      return <HeaderJuliePotVin header={header} />;
    case "nos-communes":
      return <HeaderNosCommunes header={header} />;
    case "commune-transparente":
      return <HeaderCommuneTransparente header={header} />;
    case "default":
    default:
      return <DefaultHeader />;
  }
}
