import { useQuery } from "@tanstack/react-query";
import type { Answer, EntityTypes } from "@communecter/cocolight-api-client";
import { getApi } from "@/lib/apiClient";
import { CAGNOTTE_QUERY_KEYS } from "@/modules/cagnotte/constants/queryKeys";

const LOG_PREFIX = "[useOrganizationProjectsWithAnswers]";

// === Types domaine exposés ===

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

/**
 * Projet normalisé pour les consommateurs (CagnotteDialog, etc.).
 * Le hook fait l'extraction des champs utiles depuis `searchCostum` (qui
 * retourne du JSON brut avec _serverData / EJSON inconsistant) pour éviter
 * que chaque consommateur ait à refaire la gymnastique de traversée.
 */
export interface OrgProject {
  /** ID propre du projet (extrait de `_id._str` ou `id`). */
  id: string;
  /** Nom affichable du projet (fallback "Projet sans titre" géré côté consommateur via i18n). */
  name: string;
  /** URL d'image profil (`profilImageUrl` ou `profilThumbImageUrl`). */
  image?: string;
  /** Slug du projet, si présent. */
  slug?: string;
  /** ID de l'`Answer` CoForm associée (sert au flux de contribution). */
  answerId?: string;
  /** Milestones enrichis avec leur financement courant. */
  milestones: ProjectMilestone[];
  /** Total des contributions encaissées (somme des milestones non-clôturés). */
  cagnotteTotalAmount: number;
  /** Total des coûts cibles (somme des milestones non-clôturés). */
  cagnotteTargetAmount: number;
  /** Objet projet brut tel que retourné par `searchCostum`. Disponible pour les rares cas où une donnée non normalisée est nécessaire. */
  rawProject: Record<string, unknown>;
}

// === Types schéma costum (non typés par la lib) ===
// La lib type `Answer.serverData.answers` comme `Record<string, unknown>` (cf.
// Answer.d.ts:42). Le contenu `aapStep1.depense[]` est spécifique au costum
// cagnotte — on le type localement.

interface ProjectOcecoMilestone {
  milestoneId?: string;
  name?: string;
  description?: string;
  status?: string;
}

interface AapStep1Depense {
  milestone?: string;
  price?: number;
  financer?: Array<Partial<Financer>>;
}

interface ProjectServerData {
  _id?: { _str?: string; $id?: string };
  id?: string;
  name?: string;
  slug?: string;
  profilImageUrl?: string;
  profilThumbImageUrl?: string;
  answer?: string;
  oceco?: {
    milestones?: ProjectOcecoMilestone[];
  };
}

interface AnswerServerData {
  project?: { id?: string };
  answers?: {
    aapStep1?: {
      depense?: AapStep1Depense | AapStep1Depense[];
    };
  };
}

interface UseOrganizationProjectsWithAnswersProps {
  entity: EntityTypes | null;
  enabled?: boolean;
}

// === Helpers ===

/**
 * Extrait `serverData` d'un objet en tolérant les 3 shapes possibles côté
 * Cocolight : entité avec getter (`serverData`), entité brute (`_serverData`),
 * ou objet déshydraté retourné par `searchCostum` (`results[i]` est l'objet
 * directement, sans wrapper).
 */
function extractServerData<T>(item: unknown): T {
  const candidate = item as { _serverData?: T; serverData?: T } | null | undefined;
  return (candidate?._serverData ?? candidate?.serverData ?? item) as T;
}

/**
 * Le backend peut renvoyer un id sous deux shapes (`_id._str` côté EJSON
 * sérialisé, `id` côté flat). On essaie les deux.
 */
function extractProjectId(data: ProjectServerData): string | undefined {
  return data._id?._str ?? data.id;
}

function getDepensesFromAnswer(answer: Answer): AapStep1Depense[] {
  const data = extractServerData<AnswerServerData>(answer);
  const raw = data.answers?.aapStep1?.depense;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function enrichMilestones(
  projectMilestones: ProjectOcecoMilestone[],
  depenses: AapStep1Depense[],
): ProjectMilestone[] {
  const depenseByMilestone = new Map<string, AapStep1Depense>();
  for (const depense of depenses) {
    if (depense.milestone) {
      depenseByMilestone.set(depense.milestone, depense);
    }
  }

  return projectMilestones.map((milestone) => {
    const depense = depenseByMilestone.get(milestone.milestoneId ?? "");
    const financer = (depense?.financer ?? []) as Financer[];
    const currentFunding = financer.reduce((sum, f) => sum + (f.amount || 0), 0);

    return {
      milestoneId: milestone.milestoneId ?? "",
      name: milestone.name ?? "",
      description: milestone.description ?? "",
      status: milestone.status ?? "open",
      price: depense?.price ?? 0,
      currentFunding,
      financer,
    };
  });
}

/**
 * Charge tous les projets cagnotte-enabled d'une organisation et croise avec
 * leurs réponses CoForm pour calculer `currentFunding` par milestone à partir
 * de `aapStep1.depense[].financer[]`.
 *
 * Stratégie :
 *  1. `searchCostum` filtre les projets de l'orga ayant un `answer` lié et au
 *     moins un milestone défini (filtres Mongo `answer.$exists`, `oceco.milestones.0.$exists`).
 *  2. Pour chaque projet retourné, `api.answer({id})` en parallèle (best-effort,
 *     un échec individuel ne plante pas l'ensemble).
 *  3. Enrichissement local : croise `oceco.milestones[]` × `aapStep1.depense[].financer[]`
 *     pour produire `OrgProject` typé.
 *
 * Consommé par `CagnotteDialog` + `CagnotteResourceSelector` pour peupler le
 * dropdown projets de la modale de contribution.
 */
export function useOrganizationProjectsWithAnswers({
  entity,
  enabled = true,
}: UseOrganizationProjectsWithAnswersProps) {
  const { data, isLoading, error, refetch } = useQuery<OrgProject[]>({
    queryKey: CAGNOTTE_QUERY_KEYS.ORGANIZATION_PROJECTS_WITH_ANSWERS(entity?.id ?? null),
    queryFn: async () => {
      if (!entity?.id || typeof entity.searchCostum !== "function") {
        return [];
      }

      const projectsPage = await entity.searchCostum({
        name: "",
        searchType: ["projects"],
        filters: {
          "answer": { $exists: true },
          "oceco.milestones.0": { $exists: true },
          $or: {
            "source.key": entity.slug,
            "source.keys": entity.slug,
            "reference.costum": entity.slug,
            [`parent.${entity.id}`]: { $exists: true },
          },
        },
        fields: [
          "id", "_id", "collection", "created", "name", "parent", "slug",
          "updated", "links", "answer", "oceco",
          "profilImageUrl", "profilThumbImageUrl",
        ],
        indexMin: 0,
        indexStep: 10000,
        fediverse: false,
      });

      const projects = projectsPage.results ?? [];
      if (projects.length === 0) return [];

      // Pré-extrait les infos par projet pour éviter d'appeler `extractServerData` 3×.
      // Toute la normalisation (id/name/image/slug) se fait ici une fois pour toutes —
      // les consommateurs reçoivent un `OrgProject` typé sans avoir à refaire la
      // gymnastique de traversée (`_serverData`/`serverData`/EJSON `_id._str`).
      const projectInfos = projects.map((rawProject) => {
        const data = extractServerData<ProjectServerData>(rawProject);
        return {
          rawProject: rawProject as Record<string, unknown>,
          projectId: extractProjectId(data),
          answerId: data.answer,
          name: data.name,
          slug: data.slug,
          image: data.profilImageUrl ?? data.profilThumbImageUrl,
          milestones: data.oceco?.milestones ?? [],
        };
      });

      // Charge les answers en parallèle. Un échec individuel ne fait pas
      // planter l'ensemble : on logge et on continue avec answers manquantes.
      const answerIds = projectInfos
        .map((info) => info.answerId)
        .filter((id): id is string => Boolean(id));

      const answersByProjectId = new Map<string, Answer>();
      if (answerIds.length > 0) {
        const api = await getApi();
        const fetched = await Promise.all(
          answerIds.map(async (answerId) => {
            try {
              return { answerId, answer: await api.answer({ id: answerId }) };
            } catch (err) {
              console.error(`${LOG_PREFIX} fetch answer ${answerId} failed:`, err);
              return null;
            }
          }),
        );

        for (const fetchResult of fetched) {
          if (!fetchResult) continue;
          const answerData = extractServerData<AnswerServerData>(fetchResult.answer);
          // Priorité : project.id stocké côté answer. Fallback : reverse-lookup
          // via answerId → projectId construit à partir de la liste des projets.
          const projectIdFromAnswer = answerData.project?.id;
          const fallbackProjectId = projectInfos.find(
            (info) => info.answerId === fetchResult.answerId,
          )?.projectId;
          const finalProjectId = projectIdFromAnswer ?? fallbackProjectId;
          if (finalProjectId) {
            answersByProjectId.set(String(finalProjectId), fetchResult.answer);
          }
        }
      }

      return projectInfos.map(({ rawProject, projectId, answerId, name, slug, image, milestones }): OrgProject => {
        const baseFields = {
          id: projectId ?? "",
          name: name ?? "",
          image,
          slug,
          answerId,
          rawProject,
        };

        if (milestones.length === 0) {
          return {
            ...baseFields,
            milestones: [],
            cagnotteTotalAmount: 0,
            cagnotteTargetAmount: 0,
          };
        }

        const answer = projectId ? answersByProjectId.get(String(projectId)) : undefined;
        const depenses = answer ? getDepensesFromAnswer(answer) : [];
        const enriched = enrichMilestones(milestones, depenses);
        const openMilestones = enriched.filter((m) => (m.status ?? "open") !== "close");

        return {
          ...baseFields,
          milestones: enriched,
          cagnotteTotalAmount: openMilestones.reduce((sum, m) => sum + m.currentFunding, 0),
          cagnotteTargetAmount: openMilestones.reduce((sum, m) => sum + m.price, 0),
        };
      });
    },
    enabled: enabled && !!entity?.id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    projects: data ?? [],
    isLoading,
    error,
    refetch,
  };
}
