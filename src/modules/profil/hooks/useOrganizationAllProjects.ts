import { useQuery } from "@tanstack/react-query";
import type { EntityTypes, Project } from "@communecter/cocolight-api-client";

interface UseOrganizationAllProjectsProps {
  entity: EntityTypes | null;
  entityType?: string;
  enabled?: boolean;
}

const PROJECTS_SUPPORTED_TYPES = new Set(["organizations", "citoyens"]);

/**
 * @deprecated **Code mort — aucun consommateur dans le repo (vérifié 2026-05-15).**
 *
 * Statut : créé le 2026-04-23 dans le commit fondateur cagnotte `12a92ef` ("Cagnotte modal...")
 * comme dropdown projets, mais le flow final utilise `useOrganizationProjectsWithAnswers.shared`
 * (qui retourne projets + réponses CoForm jointes en une seule requête).
 *
 * Raison du @deprecated :
 *   - Aucun import dans `src/` (grep exhaustif sur ts/tsx/json).
 *   - Utilise `(entity as any).getProjects(...)` + `indexStep: 10000` — anti-pattern (cf. AUDIT-cocolight-api-client.md §H3).
 *   - Cast `as any` désactivable via `eslint-disable` au lieu d'un narrow `isUser`/`isOrganization`.
 *
 * Alternative active :
 *   - Projets+answers d'une orga → `useOrganizationProjectsWithAnswers` (`@/modules/cagnotte/hooks`).
 *   - Projets seuls paginés → `useProfilProjectsQuery` (`@/modules/profil/hooks`) — pattern infinite scroll propre.
 *
 * À reviewer : supprimer le fichier dès la prochaine itération de cleanup
 * (même profil que C1 / C2 dans AUDIT-cocolight-api-client.md — code mort issu de PR massive).
 */
export function useOrganizationAllProjects({
  entity,
  entityType = "",
  enabled = true,
}: UseOrganizationAllProjectsProps) {
  const canFetchProjects = PROJECTS_SUPPORTED_TYPES.has(entityType);

  const { data: projects = [], isLoading, error } = useQuery<Project[]>({
    queryKey: ["organization-all-projects", entity?.id],
    queryFn: async () => {
      if (!canFetchProjects || !entity?.id) {
        return [];
      }

      try {
        // Récupérer tous les projets sans pagination (indexStep très grand)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (entity as any).getProjects({
          indexMin: 0,
          indexStep: 10000, // Grand nombre pour récupérer tout en une fois
        });

        return (result.results || []) as Project[];
      } catch (error) {
        console.error("Erreur lors de la récupération des projets:", error);
        throw error;
      }
    },
    enabled: enabled && canFetchProjects && !!entity?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  return {
    projects,
    isLoading,
    error,
  };
}




