import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getApi } from '@/lib/apiClient';
import { CAGNOTTE_QUERY_KEYS } from '@/modules/cagnotte/constants/queryKeys';

interface ProjectModalCagnotteData {
  cagnotteAmount: number;
  cagnotteTarget: number;
  projectName: string;
  isLoading: boolean;
  error: Error | null;
}

type UnknownRecord = Record<string, unknown>;

type QueryPayload = {
  cagnotteAmount: number;
  cagnotteTarget: number;
  projectName: string;
};

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function getServerData(input: UnknownRecord | null | undefined): UnknownRecord {
  if (!input) return {};

  const nestedData = input.data as UnknownRecord | undefined;
  return (
    (nestedData?._serverData as UnknownRecord) ||
    (nestedData?.serverData as UnknownRecord) ||
    nestedData ||
    (input._serverData as UnknownRecord) ||
    (input.serverData as UnknownRecord) ||
    input ||
    {}
  )
}
function getAnswerDepenses(answerEntity: UnknownRecord | null | undefined): UnknownRecord[] {
  if (!answerEntity) return [];

  const server = getServerData(answerEntity);
  const runtime = (answerEntity.data as UnknownRecord | undefined) || {};

  const candidates = [
    (((runtime.answers as UnknownRecord | undefined)?.aapStep1 as UnknownRecord | undefined)?.depense as
      | UnknownRecord
      | UnknownRecord[]
      | undefined),
    (((server.answers as UnknownRecord | undefined)?.aapStep1 as UnknownRecord | undefined)?.depense as
      | UnknownRecord
      | UnknownRecord[]
      | undefined),
  ];

  for (const candidate of candidates) {
    const depenses = toArray(candidate);
    if (depenses.length > 0) return depenses as UnknownRecord[];
  }

  return [];
}


export function useProjectModalCagnotte(
  entity: unknown,
  projectModalId: string | null | undefined
): ProjectModalCagnotteData & { refresh: () => Promise<void> } {
  const entityObj = (entity as UnknownRecord | null) || null;
  const entityId = (entityObj?.id as string | undefined) || null;

  const queryClient = useQueryClient();
  const queryKey = CAGNOTTE_QUERY_KEYS.PROJECT_MODAL_CAGNOTTE(entityId, projectModalId ?? null);
  const { data, isLoading, error, refetch } = useQuery<QueryPayload>({
    queryKey,
    queryFn: async () => {
      if (!entityObj || !projectModalId) {
        return { cagnotteAmount: 0, cagnotteTarget: 0, projectName: '' };
      }

      const normalizeEntityId = (input: UnknownRecord | null | undefined): string => {
        if (!input) return '';
        const directId = input.id;
        if (typeof directId === 'string' && directId) return directId;
        const objectId = input._id as UnknownRecord | undefined;
        const strId = objectId?._str;
        if (typeof strId === 'string' && strId) return strId;
        return '';
      };

      const deps = (entityObj.deps as UnknownRecord | undefined) || {};
      const api = await getApi();
      let projectEntity: UnknownRecord | null = null;

      try {
        const searchCostum = entityObj.searchCostum as ((payload: UnknownRecord) => Promise<unknown>) | undefined;

        if (typeof searchCostum === 'function') {
          const projectsResult = (await searchCostum.call(entityObj, {
            name: '',
            searchType: ['projects'],
            filters: { [`parent.${entityId}`]: { $exists: true } },
            fields: [
              'id',
              '_id',
              'name',
              'answer',
              'slug',
              'updated',
              'profilImageUrl',
              'profilThumbImageUrl',
            ],
            indexMin: 0,
            indexStep: 10000,
            fediverse: false,
          })) as UnknownRecord;

          const results = projectsResult.results as UnknownRecord[] | Record<string, UnknownRecord> | undefined;
          const projects = Array.isArray(results)
            ? results
            : results && typeof results === 'object'
              ? Object.values(results)
              : [];

          projectEntity =
            projects.find((project) => {
              const projectData = getServerData(project);
              return normalizeEntityId(projectData) === projectModalId;
            }) || null;
        }

        if (!projectEntity) {
          const projectMethod = entityObj.project as ((payload: { id: string }) => Promise<unknown>) | undefined;
          if (typeof projectMethod === 'function') {
            projectEntity = (await projectMethod.call(entityObj, { id: projectModalId })) as UnknownRecord;
          }
        }

        if (!projectEntity) {
          const ProjectCtor = deps.Project as
            | (new (parent: unknown, data?: UnknownRecord, depsArg?: UnknownRecord) => UnknownRecord)
            | undefined;

          if (typeof ProjectCtor === 'function') {
            const candidate = new ProjectCtor(entityObj, { id: projectModalId }, deps);
            const getMethod = candidate.get as (() => Promise<unknown>) | undefined;
            if (typeof getMethod === 'function') {
              await getMethod.call(candidate);
            }
            projectEntity = candidate;
          }
        }
      } catch (projectError) {
        console.error('Erreur lors du chargement du projet modal:', projectError);
      }

      const projectData = getServerData(projectEntity);
      const projectName = (projectData.name as string) || '';
      let answerId = projectData.answer as string | undefined;

      if (!answerId && projectModalId) {
        try {
          const apiProject = (await api.project({ id: projectModalId })) as unknown as UnknownRecord;
          const apiProjectData = getServerData(apiProject);
          answerId = apiProjectData.answer as string | undefined;
        } catch (projectFallbackError) {
          console.error('Impossible de récupérer le projet complet via api.project:', projectFallbackError);
        }
      }

      if (!answerId) {
        return { cagnotteAmount: 0, cagnotteTarget: 0, projectName };
      }

      let answerEntity: UnknownRecord | null = null;

      try {
        answerEntity = (await api.answer({ id: answerId })) as unknown as UnknownRecord;

        const depensesFromApi = getAnswerDepenses(answerEntity);
        if (depensesFromApi.length === 0) {
          const AnswerCtor = deps.Answer as
            | (new (parent: unknown, data?: UnknownRecord, depsArg?: UnknownRecord) => UnknownRecord)
            | undefined;

          if (typeof AnswerCtor === 'function') {
            const answerInstance = new AnswerCtor(entityObj, { id: answerId }, deps);
            const answerGet = answerInstance.get as (() => Promise<unknown>) | undefined;
            if (typeof answerGet === 'function') {
              await answerGet.call(answerInstance);
            }
            answerEntity = answerInstance;
          }
        }
      } catch (answerError) {
        console.error(`Erreur lors de la récupération de l'answer ${answerId}:`, answerError);
      }

      const depenses = getAnswerDepenses(answerEntity);

      const cagnotteAmount = depenses.reduce((sum, depense) => {
        const financers = toArray(depense.financer as UnknownRecord | UnknownRecord[] | null | undefined);
        const depenseFunding = financers.reduce((localSum, financer) => {
          const amount = Number(financer.amount ?? 0);
          return localSum + (Number.isFinite(amount) ? amount : 0);
        }, 0);
        return sum + depenseFunding;
      }, 0);

      const cagnotteTarget = depenses.reduce((sum, depense) => {
        const price = Number(depense.price ?? 0);
        return sum + (Number.isFinite(price) ? price : 0);
      }, 0);

      return {
        cagnotteAmount,
        cagnotteTarget,
        projectName: projectName || normalizeEntityId(projectData) || '',
      };
    },
    enabled: Boolean(entityId && projectModalId),
    staleTime: 5 * 60 * 1000,
  });

  // Permet de forcer le refresh depuis l'extérieur
  const refresh = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey, exact: true, refetchType: 'active' });
    await refetch();
  };

  return {
    cagnotteAmount: data?.cagnotteAmount || 0,
    cagnotteTarget: data?.cagnotteTarget || 0,
    projectName: data?.projectName || '',
    isLoading,
    error: error instanceof Error ? error : null,
    refresh,
  };
}
