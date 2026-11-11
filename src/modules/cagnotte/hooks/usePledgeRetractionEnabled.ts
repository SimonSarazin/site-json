import { useSite } from "@/hooks/useSite";

/** Le site propose-t-il de retirer une promesse (`cagnotteModuleConfig.pledgeRetraction`) ? */
export function usePledgeRetractionEnabled(): boolean {
  const { config } = useSite();
  return config.cagnotteModuleConfig?.pledgeRetraction === true;
}
