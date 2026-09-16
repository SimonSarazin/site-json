/**
 * L'équipe du PROJET d'un commun — la liste publique de ses contributeur·rices.
 */
import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { AAC_QUERY_KEYS } from "../constants/queryKeys";
import {
  isAdminContributorLink,
  toCommunContributors,
  toContributorRoles,
  type CommunContributor,
  type ContributorSource,
} from "../lib/communContributors";

const CONTRIBUTORS_STALE_TIME_MS = 5 * 60 * 1000;

const CONTRIBUTORS_PAGE_SIZE = 24;

export interface CommunContributorLink {
  isAdmin: boolean;
  roles: string[];
}

export interface CommunProjectContributors {
  contributors: CommunContributor[];
  /** Total côté serveur — peut dépasser la page affichée. */
  total: number;
  /**
   * Les liens du document projet, indexés par id — rôle et administration, pour
   * QUICONQUE y figure, y compris les invitations que la recherche publique ne
   * rapporte pas. Se relit tel quel par `toCommunContributors`, ce qui permet au
   * bloc « en attente » de décrire ses fiches comme les autres.
   */
  links: Record<string, CommunContributorLink>;
  isLoading: boolean;
  isError: boolean;
}

const NO_LINKS: Record<string, CommunContributorLink> = {};

export function useCommunProjectContributors(
  projectId?: string | null
): CommunProjectContributors {
  const { api } = useCocolight();
  const normalizedProjectId = String(projectId ?? "").trim();

  const query = useQuery({
    queryKey: AAC_QUERY_KEYS.COMMUN_CONTRIBUTORS(normalizedProjectId || null),
    enabled: !!api && !!normalizedProjectId,
    staleTime: CONTRIBUTORS_STALE_TIME_MS,
    queryFn: async (): Promise<{
      contributors: CommunContributor[];
      total: number;
      links: Record<string, CommunContributorLink>;
    }> => {
      const project = await api!.project({ id: normalizedProjectId });
      const page = await project.getContributors(
        { indexStep: CONTRIBUTORS_PAGE_SIZE },
        { toBeValidated: false, isInviting: false }
      );

      const rawLinks = (project.serverData?.links as { contributors?: Record<string, unknown> } | undefined)
        ?.contributors;

      const links: Record<string, CommunContributorLink> = Object.fromEntries(
        Object.entries(rawLinks ?? {}).map(([id, link]) => [
          id,
          { isAdmin: isAdminContributorLink(link), roles: toContributorRoles(link) },
        ])
      );

      return {
        contributors: toCommunContributors(page.results as ContributorSource[], links),
        total: page.count?.total ?? page.results?.length ?? 0,
        links,
      };
    },
  });

  return {
    contributors: query.data?.contributors ?? [],
    total: query.data?.total ?? 0,
    links: query.data?.links ?? NO_LINKS,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
