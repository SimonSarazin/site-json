/**
 * Hook pour récupérer les organisations dont l'utilisateur est admin
 * Utilise getOrganizations() de l'API User pour obtenir les données complètes
 */
import { useEffect, useState } from "react";
import type { User, Organization } from "@communecter/cocolight-api-client";
import { isUser } from "@/lib/getTypedEntity";

export interface AdminOrganization {
  id: string;
  name: string;
  slug?: string;
  profilImageUrl?: string;
  profilThumbImageUrl?: string;
}

/**
 * Hook pour récupérer les organisations où l'utilisateur est admin via l'API
 * @param currentUser - L'utilisateur courant (peut être null)
 * @returns Liste des organisations admin de l'utilisateur
 */
export function useUserAdminOrganizations(currentUser: User | null): AdminOrganization[] {
  const [adminOrganizations, setAdminOrganizations] = useState<AdminOrganization[]>([]);

  useEffect(() => {
    if (!currentUser || !isUser(currentUser)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAdminOrganizations([]);
      return;
    }

    const fetchAdminOrganizations = async () => {
      try {
        // Utiliser getOrganizations() pour récupérer les organisations complètes
        const result = await currentUser.getOrganizations({
          indexMin: 0,
          indexStep: 10000,
        });

        const organizations = result.results || [];

        // Filtrer pour garder uniquement les organisations où l'utilisateur est admin
        const adminOrgs = organizations
          .filter((org: Organization) => {
            // Vérifier si l'utilisateur est admin de cette organisation
            // En regardant les liens de l'organisation
            const orgLinks = (org as unknown as { _serverData?: { links?: { members?: Record<string, { isAdmin?: boolean }> } } })._serverData?.links?.members || {};
            const userLink = orgLinks[currentUser.id];
            return userLink?.isAdmin === true;
          })
          .map((org: Organization): AdminOrganization => ({
            id: org.id || "",
            name: org.data?.name || "Organisation sans nom",
            slug: org.data?.slug,
            profilImageUrl: org.data?.profilImageUrl,
            profilThumbImageUrl: org.data?.profilThumbImageUrl,
          }));

        setAdminOrganizations(adminOrgs);
      } catch (error) {
        console.error("❌ useUserAdminOrganizations error:", error);
        setAdminOrganizations([]);
      }
    };

    fetchAdminOrganizations();
  }, [currentUser]);

  return adminOrganizations;
}

