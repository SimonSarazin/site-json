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
import type { CoFormAnswer } from "@/modules/coform/types";
import { useFundingEnvelope } from "@/modules/cagnotte/hooks/useFundingEnvelope";
import { useCagnotteType } from "@/modules/cagnotte/hooks/useCagnotteType";
import { useOrganizationProjectsWithAnswers } from "@/modules/cagnotte/hooks/useOrganizationProjectsWithAnswers";
import { useCagnotteAdapter, useOrphanDepenseRepair } from "@/modules/cagnotte/hooks/useCagnotteAdapter";
import { useCagnottePermissions } from "@/modules/cagnotte/hooks/useCagnottePermissions";
import { buildResourceFromAnswer } from "@/modules/cagnotte/utils/dataTransform";
import type { CagnotteResource } from "@/modules/cagnotte/types";
import { useCommunProjectEntity } from "@/modules/aac/hooks/useCommunProjectEntity";
import { resolveCommunOwnerIds } from "@/modules/aac/lib/objectiveHelpers";

/** Le document réponse tel que `resolveCommunOwnerIds` sait le lire — ou rien. */
function asOwnerAnswer(answer: unknown): Pick<CoFormAnswer, "userId" | "user"> | null {
  return answer && typeof answer === "object" ? (answer as Pick<CoFormAnswer, "userId" | "user">) : null;
}

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

  /**
   * `allProjects` n'est lu par `useCagnotteAdapter` QUE dans sa branche
   * `selectorType === "project"` (cagnotte « standard ») ; en mode `proposition`
   * — le `defaultType: "aac"` des sites AAC — les ressources viennent de
   * l'enveloppe seule. Or ce hook coûte un `searchCostum` borné à 10 000 projets
   * PLUS un `api.answer` par projet retourné, en parallèle : sur un costum à 200
   * projets cagnotte, 201 requêtes dont rien ne dépendait — à l'ouverture de la
   * fiche comme à celle de la modale de dépôt (`MilestoneListField`). On ne le
   * déclenche que pour le mode qui le lit.
   */
  const { projects: allProjects } = useOrganizationProjectsWithAnswers({
    entity: entity || null,
    enabled: !!entity && cagnotteConfig.selectorType === "project",
  });

  const selectedProjectContextId = String(answerId || "").trim();
  const { savedSelectedResource, pendingMilestoneRepairs } = useCagnotteAdapter(
    fundingData,
    allProjects,
    cagnotteConfig,
    selectedProjectContextId,
  );

  /**
   * Réparation des dépenses orphelines de CE commun (dépense sans palier projet) :
   * une écriture sur le projet lié et sur la réponse, réservée à qui a le droit de
   * créer un palier — admin du projet lié, ou déposant du commun (`ownerIds`). Les
   * deux surfaces qui passent par ici (fiche commun, `MilestoneListField`) sont des
   * surfaces d'édition ; l'adaptateur, lui, n'écrit plus (M40). Même entité et
   * mêmes `ownerIds` que le contrôleur de la fiche — même entrée de cache pour le
   * projet, donc aucune requête supplémentaire.
   */
  const projectEntity = useCommunProjectEntity(savedSelectedResource?.projectId);
  const ownerIds = useMemo(() => resolveCommunOwnerIds(asOwnerAnswer(options?.answer)), [options?.answer]);
  const repairPerms = useCagnottePermissions(projectEntity, { ownerIds });
  useOrphanDepenseRepair({
    resource: savedSelectedResource,
    repairs: pendingMilestoneRepairs,
    enabled: repairPerms.canCreateMilestone,
  });

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
