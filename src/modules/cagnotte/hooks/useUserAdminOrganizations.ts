/**
 * Hook pour récupérer les organisations dont l'utilisateur est admin.
 * Délègue à useUserOrganizations (TanStack + SSR + infinite scroll) avec un filtre serveur.
 */
import { useMemo } from "react";
import type { User, Organization } from "@communecter/cocolight-api-client";
import { useUserOrganizations } from "@/modules/profil/hooks/useMembershipQuery";
import { validatedAdminLinkFilters } from "@/modules/profil/lib/adminLinks";

export interface AdminOrganization {
  id: string;
  name: string;
  slug?: string;
  profilImageUrl?: string;
  profilThumbImageUrl?: string;
}

export interface UseUserAdminOrganizationsParams {
  /** Terme de recherche fuzzy par nom (côté serveur). Pense à débouncer en amont. */
  search?: string;
}

export interface UseUserAdminOrganizationsResult {
  organizations: AdminOrganization[];
  /** Vrai tant que la première page n'est pas arrivée — à distinguer d'une liste vide. */
  isLoading: boolean;
}

export function useUserAdminOrganizationsQuery(
  currentUser: User | null,
  params?: UseUserAdminOrganizationsParams
): UseUserAdminOrganizationsResult {
  const userId = currentUser?.id ?? "";

  // Pas de mémo : la clé de requête est comparée par VALEUR, un nouvel objet de filtres ne la change pas.
  const filters = userId ? validatedAdminLinkFilters(userId) : undefined;

  const { organizations, isLoading } = useUserOrganizations(currentUser, {
    indexStep: 100,
    search: params?.search,
    filters,
  });

  const adminOrganizations = useMemo(
    () =>
      organizations.map((org: Organization): AdminOrganization => ({
        id: org.id ?? "",
        name: org.data?.name ?? "Organisation sans nom",
        slug: org.data?.slug,
        profilImageUrl: org.data?.profilImageUrl,
        profilThumbImageUrl: org.data?.profilThumbImageUrl,
      })),
    [organizations]
  );

  return useMemo(
    () => ({ organizations: adminOrganizations, isLoading }),
    [adminOrganizations, isLoading]
  );
}

export function useUserAdminOrganizations(
  currentUser: User | null,
  params?: UseUserAdminOrganizationsParams
): AdminOrganization[] {
  return useUserAdminOrganizationsQuery(currentUser, params).organizations;
}
