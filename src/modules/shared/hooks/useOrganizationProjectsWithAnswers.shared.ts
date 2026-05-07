import { useQuery } from "@tanstack/react-query";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { getApi } from "@/lib/apiClient";

interface Financer {
  amount: number;
  date: string;
  user: string;
  id: string;
  name: string;
  type: string;
  fundingType: string;
}

interface ProjectMilestone {
  milestoneId: string;
  name: string;
  description?: string;
  status?: string;
  price: number;
  currentFunding: number;
  financer: Financer[];
}

type LooseRecord = Record<string, unknown>;

type ProjectWithMilestones = LooseRecord & {
  milestones?: ProjectMilestone[];
  cagnotteTotalAmount?: number;
  cagnotteTargetAmount?: number;
};

interface UseOrganizationProjectsWithAnswersProps {
  entity: EntityTypes | null;
  entityType?: string;
  enabled?: boolean;
}

type SearchResult = {
  results?: LooseRecord[] | Record<string, LooseRecord>;
};

type SearchableEntity = EntityTypes & {
  id: string;
  searchCostum: (params: LooseRecord) => Promise<SearchResult>;
};

type ProjectMilestonePayload = {
  milestoneId?: string;
  name?: string;
  description?: string;
  status?: string;
};

type ProjectPayload = LooseRecord & {
  id?: string;
  _id?: { _str?: string };
  name?: string;
  answer?: string;
  oceco?: {
    milestones?: ProjectMilestonePayload[];
  };
};

type DepenseFinancer = Partial<Financer> & { amount?: number };

type DepensePayload = {
  milestone?: string;
  price?: number;
  financer?: DepenseFinancer[];
};

type AnswerPayload = LooseRecord & {
  id?: string;
  project?: { id?: string };
  answers?: {
    aapStep1?: {
      depense?: DepensePayload | DepensePayload[];
    };
  };
};

/**
 * Implémentation partagée unique pour éviter la divergence entre modules.
 */
export function useOrganizationProjectsWithAnswers({
  entity,
  enabled = true,
}: UseOrganizationProjectsWithAnswersProps) {
  const {
    data: projectsWithMilestones = [],
    isLoading,
    error,
    refetch,
  } = useQuery<ProjectWithMilestones[]>({
    queryKey: ["organization-projects-with-answers", entity?.id],
    queryFn: async () => {
      if (!entity?.id) {
        console.warn("⚠️ Pas d entity?.id");
        return [];
      }

      const searchableEntity = entity as SearchableEntity;

      if (typeof searchableEntity.searchCostum !== "function") {
        console.warn("⚠️ L entité n a pas de méthode searchCostum");
        return [];
      }

      try {
        const getServerData = <T,>(item: unknown): T => {
          const candidate = item as { _serverData?: T; serverData?: T } | null | undefined;
          return (candidate?._serverData ?? candidate?.serverData ?? item) as T;
        };

        const normalizeSearchResults = (result: SearchResult | null | undefined): LooseRecord[] => {
          const results = result?.results;
          if (!results) return [];
          if (Array.isArray(results)) return results;
          if (typeof results === "object") return Object.values(results);
          return [];
        };

        console.log('Anatolelog 5',entity);
        const projectsResult = await searchableEntity.searchCostum({
          name: "",
          searchType: ["projects"],
          filters: {
            "$or": {
              "source.key": entity.slug,
              "source.keys": entity.slug,
              "reference.costum": entity.slug,
              [`parent.${entity.id}`]: { $exists: true }
            }
          },
          fields: [
            "id",
            "_id",
            "collection",
            "created",
            "name",
            "parent",
            "slug",
            "updated",
            "links",
            "answer",
            "oceco",
            "profilImageUrl",
            "profilThumbImageUrl",
          ],
          indexMin: 0,
          indexStep: 10000,
          fediverse: false,
        });

        const projects = normalizeSearchResults(projectsResult);

        if (projects.length === 0) {
          console.warn("⚠️ Aucun projet trouvé");
          return [];
        }

        const getProjectData = (project: unknown): ProjectPayload => getServerData<ProjectPayload>(project);

        if (projects.length > 0) {
          getProjectData(projects[0]);
        }

        const answerIds = projects
          .map((project) => getProjectData(project)?.answer)
          .filter(Boolean);

        const answersMap = new Map<string, AnswerPayload>();
        if (answerIds.length > 0) {
          const api = await getApi();

          const answersPromises = answerIds.map(async (answerId) => {
            try {
              const normalizedAnswerId = String(answerId);
              const answerEntity = await api.answer({ id: normalizedAnswerId });
              const answerData = getServerData<AnswerPayload>(answerEntity);

              if (answerData) {
                return { id: normalizedAnswerId, data: answerData };
              }

              return null;
            } catch (error) {
              console.error(`❌ Impossible de récupérer answer ${answerId}:`, error);
              return null;
            }
          });

          const answersResults = await Promise.all(answersPromises);

          const answerIdToProjectId = new Map<string, string>();
          projects.forEach((project) => {
            const projectData = getProjectData(project);
            const projectId = projectData?._id?._str || projectData?.id;
            const projectAnswerId = projectData?.answer;
            if (projectId && projectAnswerId) {
              answerIdToProjectId.set(String(projectAnswerId), String(projectId));
            }
          });

          answersResults.forEach((result) => {
            if (result) {
              const { id: fetchedAnswerId, data: answerData } = result;
              const projectIdFromAnswer = answerData?.project?.id;
              const projectIdFromProjectAnswer = answerIdToProjectId.get(String(fetchedAnswerId));
              const projectId = projectIdFromAnswer || projectIdFromProjectAnswer;

              if (projectId) {
                answersMap.set(projectId, answerData);
              } else {
                console.warn(`  ⚠️ Impossible d'associer l'answer ${fetchedAnswerId} à un projet`);
              }
            }
          });

        }

        const projectsWithAnswers = projects.map((project) => {
          try {
            const projectData = getProjectData(project);
            const projectId = projectData?._id?._str || projectData?.id;
            const milestones = projectData?.oceco?.milestones || [];

            if (milestones.length === 0) {
              return {
                ...project,
                milestones: [],
                cagnotteTotalAmount: 0,
                cagnotteTargetAmount: 0,
              };
            }

            const answerData = projectId ? answersMap.get(projectId) : null;

            if (!answerData) {
              console.warn(`  ⚠️ Pas d'answer trouvée pour le projet ${projectId}`);
              return {
                ...project,
                milestones: milestones.map((m) => ({
                  milestoneId: m.milestoneId || "",
                  name: m.name || "",
                  description: m.description || "",
                  status: m.status || "open",
                  price: 0,
                  currentFunding: 0,
                  financer: [],
                })),
                cagnotteTotalAmount: 0,
                cagnotteTargetAmount: 0,
              };
            }

            const enrichedMilestones = enrichMilestonesWithFinancing(milestones, answerData);
            const openMilestones = enrichedMilestones.filter((m) => (m.status || 'open') !== 'close');
            const totalAmount = openMilestones.reduce((sum, m) => sum + m.currentFunding, 0);
            const targetAmount = openMilestones.reduce((sum, m) => sum + m.price, 0);

            return {
              ...project,
              milestones: enrichedMilestones,
              cagnotteTotalAmount: totalAmount,
              cagnotteTargetAmount: targetAmount,
            };
          } catch (error) {
            console.error("❌ Erreur pour le projet:", error);
            return {
              ...project,
              milestones: [],
              cagnotteTotalAmount: 0,
              cagnotteTargetAmount: 0,
            };
          }
        });

        return projectsWithAnswers;
      } catch {
        return [];
      }
    },
    enabled: enabled && !!entity?.id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    projects: projectsWithMilestones,
    isLoading,
    error,
    refetch,
  };
}

function enrichMilestonesWithFinancing(
  projectMilestones: ProjectMilestonePayload[],
  answerData: AnswerPayload,
): ProjectMilestone[] {
  if (!answerData?.answers?.aapStep1?.depense) {
    return projectMilestones.map((m) => ({
      milestoneId: m.milestoneId || "",
      name: m.name || "",
      description: m.description || "",
      status: m.status || "open",
      price: 0,
      currentFunding: 0,
      financer: [],
    }));
  }

  const depenses = Array.isArray(answerData.answers.aapStep1.depense)
    ? answerData.answers.aapStep1.depense
    : [answerData.answers.aapStep1.depense];

  const depenseMap = new Map<string, DepensePayload>();
  depenses.forEach((depense) => {
    if (depense.milestone) {
      depenseMap.set(depense.milestone, depense);
    }
  });

  return projectMilestones.map((milestone) => {
    const depense = depenseMap.get(milestone.milestoneId || "");

    if (!depense) {
      return {
        milestoneId: milestone.milestoneId || "",
        name: milestone.name || "",
        description: milestone.description || "",
        status: milestone.status || "open",
        price: 0,
        currentFunding: 0,
        financer: [],
      };
    }

    const financer = depense.financer || [];
    const currentFunding = financer.reduce((sum: number, f) => sum + (f.amount || 0), 0);

    return {
      milestoneId: milestone.milestoneId || "",
      name: milestone.name || "",
      description: milestone.description || "",
      status: milestone.status || "open",
      price: depense.price || 0,
      currentFunding,
      financer: financer as Financer[],
    };
  });
}
