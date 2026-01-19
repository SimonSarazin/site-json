import { useSite } from "@/hooks/useSite";
import { DefaultHeader } from "./header/DefaultHeader";
import HeaderTiersLieux from "./header/HeaderTiersLieux";
import HeaderRezoLaMer from "./header/HeaderRezoLaMer";

export function SiteHeader() {
  const { config } = useSite();
  const header = config.header;

  switch (header?.type) {
    case "tiers-lieux":
      return <HeaderTiersLieux header={header} />;
    case "rezo-la-mer":
      return <HeaderRezoLaMer header={header} />;
    case "default":
    default:
      return <DefaultHeader />;
  }
}
