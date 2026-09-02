/**
 * Résolution de la ressource de financement (paliers/actions) d'un commun AAC
 * à partir de son `answerId` — pipeline partagé entre `AacCommunDetailPage`
 * (affichage) et le champ coform `MilestoneListField`
 * (`tpls.forms.ocecoform.newDepenseList`, édition des paliers dans le form).
 */
import { useCocolight } from "@/hooks/useCocolight";
import { useSite } from "@/hooks/useSite";
import { useFundingEnvelope } from "@/modules/cagnotte/hooks/useFundingEnvelope";
import { useCagnotteType } from "@/modules/cagnotte/hooks/useCagnotteType";
import { useOrganizationProjectsWithAnswers } from "@/modules/cagnotte/hooks/useOrganizationProjectsWithAnswers";
import { useCagnotteAdapter } from "@/modules/cagnotte/hooks/useCagnotteAdapter";
import type { CagnotteResource } from "@/modules/cagnotte/types";

export function useAacFundingResource(answerId?: string): {
  targetResource: CagnotteResource | undefined;
  /** Slug du projet lié — résolu depuis `fundingData.projects[]`, 0 requête réseau supplémentaire. */
  projectSlug: string | undefined;
} {
  const { entity } = useCocolight();
  const { data: fundingData } = useFundingEnvelope(answerId);
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

  const projectSlug = fundingData?.projects?.find(
    (project) => project.id === savedSelectedResource?.projectId
  )?.slug || undefined;

  return { targetResource: savedSelectedResource, projectSlug };
}
