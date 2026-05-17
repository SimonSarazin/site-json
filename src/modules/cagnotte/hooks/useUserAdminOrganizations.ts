/**
 * Hook pour récupérer les organisations dont l'utilisateur est admin.
 * Délègue à useUserOrganizations (TanStack + SSR + infinite scroll) avec un filtre serveur.
 */
import { useMemo } from "react";
import type { User, Organization } from "@communecter/cocolight-api-client";
import { useUserOrganizations } from "@/modules/profil/hooks/useMembershipQuery";

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

export function useUserAdminOrganizations(
  currentUser: User | null,
  params?: UseUserAdminOrganizationsParams
): AdminOrganization[] {
  const userId = currentUser?.id ?? "";

  const filters = useMemo(
    () =>
      userId
        ? {
            [`links.members.${userId}`]: { $exists: true },
            [`links.members.${userId}.isAdmin`]: true,
            [`links.members.${userId}.isAdminPending`]: { $exists: false },
            [`links.members.${userId}.toBeValidated`]: { $exists: false },
            [`links.members.${userId}.isInviting`]: { $exists: false },
          }
        : undefined,
    [userId]
  );

  const { organizations } = useUserOrganizations(currentUser, {
    indexStep: 100,
    search: params?.search,
    filters,
  });

  return useMemo(
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
}
