import { useQuery } from "@tanstack/react-query";
import type { EntityTypes, Project } from "@communecter/cocolight-api-client";

interface UseOrganizationAllProjectsProps {
  entity: EntityTypes | null;
  entityType?: string;
  enabled?: boolean;
}

const PROJECTS_SUPPORTED_TYPES = new Set(["organizations", "citoyens"]);

/**
 * Hook pour récupérer TOUS les projets d'une organisation en une seule requête.
 * Utilisé pour les SELECT/dropdowns qui nécessitent la liste complète.
 *
 * @param entity - L'entité (organisation ou citoyen)
 * @param entityType - Le type de l'entité ("organizations" ou "citoyens")
 * @param enabled - Activer/désactiver la requête
 * @returns Objet contenant: projects (Project[]), isLoading, error
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




