import { useSite } from "@/hooks/useSite";
import { lazy } from "vite-preload";

/**
 * Footers en `lazy()` — même pattern que SiteHeader.
 * Cf. `SiteHeader.tsx` pour la rationale.
 */
const DefaultFooter = lazy(() => import("./footer/DefaultFooter"));
const FooterRich = lazy(() => import("./footer/FooterRich"));
const FooterMinimalCentered = lazy(() => import("./footer/FooterMinimalCentered"));
const FooterSidebarColumns = lazy(() => import("./footer/FooterSidebarColumns"));
const FooterContactPartners = lazy(() => import("./footer/FooterContactPartners"));

export function SiteFooter() {
  const { config } = useSite();
  const footer = config.footer;

  switch (footer.type) {
    case "minimal-centered":
      return <FooterMinimalCentered footer={footer} />;
    case "contact-partners":
      return <FooterContactPartners footer={footer} />;
    case "sidebar-columns":
      return <FooterSidebarColumns footer={footer} style={footer.style} />;
    case "rich":
      return <FooterRich footer={footer} />;
    case "default":
    default:
      return <DefaultFooter footer={footer} />;
  }
}
