/**
 * Résolution de la ressource de financement (paliers/actions) d'un commun AAC
 * à partir de son `answerId` — pipeline partagé entre `AacCommunDetailPage`
 * (affichage) et le champ coform `MilestoneListField`
 * (`tpls.forms.ocecoform.newDepenseList`, édition des paliers dans le form).
 *
 * Deux sources, dans cet ordre :
 *  1. l'**enveloppe** du contexte porteur du commun (`hostEntity`) — elle seule
 *     porte les financeurs, les totaux consolidés et les actions ;
 *  2. à défaut, le **document réponse** lui-même (`buildResourceFromAnswer`).
 *
 * Le repli n'est pas cosmétique : sans lui, un commun absent de l'enveloppe
 * interrogée rend `undefined`, et la fiche perd son `projectId` — donc la
 * section « Suivi des actions », la création de palier et le ciblage de la modale.
 */
import { useMemo } from "react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { useSite } from "@/hooks/useSite";
import { useFundingEnvelope } from "@/modules/cagnotte/hooks/useFundingEnvelope";
import { useCagnotteType } from "@/modules/cagnotte/hooks/useCagnotteType";
import { useOrganizationProjectsWithAnswers } from "@/modules/cagnotte/hooks/useOrganizationProjectsWithAnswers";
import { useCagnotteAdapter } from "@/modules/cagnotte/hooks/useCagnotteAdapter";
import { buildResourceFromAnswer } from "@/modules/cagnotte/utils/dataTransform";
import type { CagnotteResource } from "@/modules/cagnotte/types";

export interface UseAacFundingResourceOptions {
  hostEntity?: EntityTypes | null;
  isHostLoading?: boolean;
  answer?: unknown;
  step?: string;
}

export function useAacFundingResource(
  answerId?: string,
  options?: UseAacFundingResourceOptions,
): {
  targetResource: CagnotteResource | undefined;
  /** Slug du projet lié — résolu depuis `fundingData.projects[]`, 0 requête réseau supplémentaire. */
  projectSlug: string | undefined;
} {
  const { entity } = useCocolight();
  const { data: fundingData } = useFundingEnvelope(answerId, {
    hostEntity: options?.hostEntity,
    enabled: !options?.isHostLoading,
  });
  const siteConfig = useSite();

  const { config: cagnotteConfig } = useCagnotteType({
    siteConfig: siteConfig?.config?.cagnotteModuleConfig?.defaultType,
  });

  const { projects: allProjects } = useOrganizationProjectsWithAnswers({
    entity: entity || null,
    enabled: !!entity,
  });

  const selectedProjectContextId = String(answerId || "").trim();
  const { savedSelectedResource } = useCagnotteAdapter(
    fundingData,
    allProjects,
    cagnotteConfig,
    selectedProjectContextId,
  );

  const answerResource = useMemo(
    () => (options?.answer ? buildResourceFromAnswer(options.answer, options.step) : null),
    [options?.answer, options?.step],
  );

  const targetResource = savedSelectedResource ?? answerResource ?? undefined;

  const projectSlug = fundingData?.projects?.find(
    (project) => project.id === targetResource?.projectId
  )?.slug || undefined;

  return { targetResource, projectSlug };
}
