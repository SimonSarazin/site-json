import { useMemo } from "react";
import { useSite } from "@/hooks/useSite";
import { useCagnotteType } from "./useCagnotteType";
import type { FundingEnvelopeForm } from "./useFundingEnvelope";

/**
 * Formulaire que l'enveloppe du site doit lire : en mode `proposition` (type `aac`), celui de
 * l'annuaire (`config.aac.formId`) ; sinon aucun, et `getFormData` lit le premier formulaire de l'hôte.
 */
export function useSiteEnvelopeForm(): FundingEnvelopeForm | null {
  const { config } = useSite();
  const { config: cagnotteConfig } = useCagnotteType({ siteConfig: config.cagnotteModuleConfig?.defaultType });
  const formId = cagnotteConfig.selectorType === "proposition" ? config.aac?.formId : undefined;
  return useMemo(() => (formId ? { id: formId } : null), [formId]);
}
