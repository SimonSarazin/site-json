import { useSite } from "@/hooks/useSite";
import { DefaultFooter } from "./footer/DefaultFooter";
import FooterTiersLieux from "./footer/FooterTiersLieux";

export function SiteFooter() {
  const { config } = useSite();
  const footer = config.footer;

  switch (footer.type) {
    case "tiers-lieux":
      return <FooterTiersLieux footer={footer} />;
    case "default":
    default:
      return <DefaultFooter />;
  }
}
