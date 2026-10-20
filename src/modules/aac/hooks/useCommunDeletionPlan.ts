/**
 * Plan de suppression d'un commun vu depuis l'annuaire, qui n'a ni son financement ni son
 * projet : document réponse → hôte de son contexte → enveloppe → `resolveCommunDeletionPlan`.
 *
 * Lecture seule : aucune réparation de dépense. Tant que `answerId` est nul, ni le commun ni son
 * enveloppe ne sont lus.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { useSite } from "@/hooks/useSite";
import { useFundingEnvelope } from "@/modules/cagnotte/hooks/useFundingEnvelope";
import { useCagnotteType } from "@/modules/cagnotte/hooks/useCagnotteType";
import { useCagnotteAdapter } from "@/modules/cagnotte/hooks/useCagnotteAdapter";
import { buildResourceFromAnswer } from "@/modules/cagnotte/utils/dataTransform";
import { COMMUN_ANSWER_QUERY_KEY, fetchCommunAnswer } from "../prefetch/prefetchCommun";
import { resolveCommunDeletionPlan, type CommunDeletionPlan } from "../lib/communDeletion";
import { useCommunFundingContext } from "./useCommunFundingContext";
import { useCommunFundingHost } from "./useCommunFundingHost";

const AUCUN_PROJET: never[] = [];

export interface UseCommunDeletionPlanResult {
  plan: CommunDeletionPlan;
  /** Vrai tant que le plan n'est pas résolu : la suppression ne doit pas être confirmée. */
  isLoading: boolean;
}

/**
 * @param answerId - le commun visé, `null` au repos.
 * @param step - étape portant `depense[]`, pour le repli sur le document.
 */
export function useCommunDeletionPlan(answerId: string | null, step?: string): UseCommunDeletionPlanResult {
  const { api, me } = useCocolight();
  const siteConfig = useSite();

  const answerQuery = useQuery({
    queryKey: COMMUN_ANSWER_QUERY_KEY(answerId, me?.id ?? null),
    queryFn: () => {
      if (!api || !answerId) throw new Error("Missing answer id");
      return fetchCommunAnswer(api, answerId);
    },
    enabled: !!api && !!answerId,
    staleTime: 2 * 60 * 1000,
  });
  const answer = answerId ? answerQuery.data : undefined;

  const { context, isLoading: isContextLoading } = useCommunFundingContext(answer);
  const { hostEntity, isLoading: isHostLoading } = useCommunFundingHost(context);
  const isHostResolved = !!answer && !isContextLoading && !isHostLoading;

  const envelope = useFundingEnvelope(answerId ?? undefined, {
    hostEntity,
    enabled: !!answerId && isHostResolved,
  });

  const { config: cagnotteConfig } = useCagnotteType({
    siteConfig: siteConfig?.config?.cagnotteModuleConfig?.defaultType,
  });
  const { savedSelectedResource } = useCagnotteAdapter(
    answerId ? envelope.data : undefined,
    AUCUN_PROJET,
    cagnotteConfig,
    answerId ?? "",
  );

  // Le document porte déjà les financeurs : un versement bloque la suppression même si
  // l'enveloppe ne contient pas le commun. Seules les actions viennent de l'enveloppe.
  const answerResource = useMemo(
    () => (answer ? buildResourceFromAnswer(answer, step) : null),
    [answer, step],
  );
  const resource = savedSelectedResource ?? answerResource;
  const plan = useMemo(() => resolveCommunDeletionPlan(resource), [resource]);

  // Une réponse illisible laisse le plan en attente : pas de confirmation à l'aveugle.
  const isLoading = !!answerId && (!isHostResolved || envelope.isLoading);

  return { plan, isLoading };
}
