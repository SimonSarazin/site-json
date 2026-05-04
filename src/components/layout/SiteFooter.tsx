import { useSite } from "@/hooks/useSite";
import { DefaultFooter } from "./footer/DefaultFooter";
import FooterTiersLieux from "./footer/FooterTiersLieux";
import FooterRezoLaMer from "./footer/FooterRezoLaMer";
import FooterCommuneTransparente from "./footer/FooterCommuneTransparente";
import FooterSSBE from "./footer/FooterSSBE";

export function SiteFooter() {
  const { config } = useSite();
  const footer = config.footer;

  switch (footer.type) {
    case "tiers-lieux":
      return <FooterTiersLieux footer={footer} />;
    case "ssbe":
      return <FooterSSBE footer={footer} />;
    case "rezo-la-mer":
    case "cyber-reunion":
      return <FooterRezoLaMer footer={footer} />;
    case "commune-transparente":
      return <FooterCommuneTransparente footer={footer} />;
    case "default":
    default:
      return <DefaultFooter />;
  }
}
