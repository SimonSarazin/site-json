import { useSite } from "@/hooks/useSite";
import { DefaultHeader } from "./header/DefaultHeader";
import HeaderTiersLieux from "./header/HeaderTiersLieux";
import HeaderRezoLaMer from "./header/HeaderRezoLaMer";
import HeaderJuliePotVin from "./header/HeaderJuliePotVin";

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
    case "default":
    default:
      return <DefaultHeader />;
  }
}
