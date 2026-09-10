/**
 * L'entité SUR LAQUELLE lire l'enveloppe de financement d'un commun.
 *
 * Le périmètre d'une `fundingEnvelope` n'est pas un paramètre de requête : le SDK
 * (`BaseEntity._withCostumContext`) l'impose depuis l'entité appelante. Interroger
 * l'entité du site revient donc à demander « les propositions de MON appel » — un
 * commun déposé sur l'appel d'une autre organisation, et seulement SÉLECTIONNÉ ici,
 * n'y figure pas. On résout donc l'hôte du contexte du commun lui-même.
 *
 * Cas nominal (le commun appartient à l'appel du site) : AUCUNE requête — on rend
 * l'entité déjà en main.
 */
import { useQuery } from "@tanstack/react-query";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { resolveHostEntity } from "@/modules/news/lib/resolveHostEntity";
import { AAC_QUERY_KEYS } from "../constants/queryKeys";
import type { AacContext } from "../lib/formParent";

export interface UseCommunFundingHostResult {
  /** L'hôte à passer à `useFundingEnvelope({ hostEntity })`. `null` tant qu'il charge. */
  hostEntity: EntityTypes | null;
  /** Une résolution distante est en cours (jamais vrai dans le cas nominal). */
  isLoading: boolean;
}

/**
 * @param context - contexte porteur du commun (`firstParent` du form sur lequel il a
 *   été DÉPOSÉ), tel que le rend `useCommunFundingContext`. `null`/indéfini ⇒ le
 *   commun appartient à l'appel d'ici : l'entité du site fait l'hôte, sans requête.
 */
export function useCommunFundingHost(
  context: AacContext | null | undefined
): UseCommunFundingHostResult {
  const { api, entity } = useCocolight();

  const contextId = String(context?.id ?? "").trim();
  const contextType = String(context?.type ?? "").trim();

  // L'appel appartient au site : l'entité courante EST l'hôte. Pas de requête, et
  // surtout pas d'instance concurrente de la même entité (elle porte le slug costum
  // dont dépend le reste du module).
  const isSiteHost = !contextId || !contextType || contextId === (entity?.id ?? "");

  const { data, isLoading } = useQuery({
    queryKey: AAC_QUERY_KEYS.FUNDING_HOST(contextType || null, contextId || null),
    enabled: !!api && !isSiteHost,
    staleTime: 5 * 60 * 1000,
    queryFn: () => resolveHostEntity(api, contextType, contextId),
  });

  if (isSiteHost) {
    return { hostEntity: entity ?? null, isLoading: false };
  }

  return { hostEntity: data ?? null, isLoading };
}
