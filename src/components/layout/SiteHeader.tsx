import { useSite } from "@/hooks/useSite";
import { DefaultHeader } from "./header/DefaultHeader";
import HeaderTiersLieux from "./header/HeaderTiersLieux";

export function SiteHeader() {
  const { config } = useSite();
  const header = config.header;

  switch (header.type) {
    case "tiers-lieux":
      return <HeaderTiersLieux header={header} />;
    case "default":
    default:
      return <DefaultHeader header={header} />;
  }
}
