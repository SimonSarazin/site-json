import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { CAGNOTTE_QUERY_KEYS } from "@/modules/cagnotte/constants/queryKeys";
import { useFundingEnvelopeAction } from "@/modules/cagnotte/hooks/useFundingEnvelopeAction";
import { readCagnotteBills, type CagnotteBillFilter } from "@/modules/cagnotte/services/cagnotteBills";

/**
 * Factures de la cagnotte de l'entité du site (`cagnotteBills`) : toutes pour un admin de l'entité, celles de
 * l'utilisateur sinon (`scope`).
 */
export function useCagnotteBills(filter: CagnotteBillFilter) {
  const { entity, me } = useCocolight();
  const submit = useFundingEnvelopeAction();
  return useQuery({
    queryKey: CAGNOTTE_QUERY_KEYS.CAGNOTTE_BILLS(entity?.id ?? null, me?.id ?? null, filter),
    queryFn: async () => readCagnotteBills(await submit("cagnotteBills", { filter })),
    enabled: Boolean(entity && me?.id),
  });
}
