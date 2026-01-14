import type { User, Organization } from "@communecter/cocolight-api-client";

/**
 * Interface pour les informations d'un auteur extraites
 */
export interface AuthorInfo {
  id: string;
  name: string;
  photo: string | null;
}

/**
 * Vérifie si un objet est une entité (User ou Organization) avec serverData
 * @param obj - L'objet à vérifier
 * @returns true si l'objet est une entité avec serverData
 */
export function isEntityInstance(obj: unknown): obj is User | Organization {
  return obj !== null && typeof obj === "object" && "serverData" in obj;
}

/**
 * Extrait les informations d'un auteur (peut être un objet brut ou une entité)
 * Gère les deux cas:
 * - Entité avec serverData (User, Organization)
 * - Objet brut avec id/name/profilThumbImageUrl
 *
 * @param author - L'auteur à extraire (entité ou objet brut)
 * @returns Les informations formatées de l'auteur
 */
export function extractAuthorInfo(author: unknown): AuthorInfo {
  // Si c'est une entité avec serverData
  if (isEntityInstance(author)) {
    return {
      id: author.serverData?.id || "",
      name: author.serverData?.name || "Anonyme",
      photo: author.serverData?.profilThumbImageUrl || null,
    };
  }

  // Si c'est un objet brut
  if (author && typeof author === "object") {
    const authorObj = author as Record<string, unknown>;
    return {
      id: (authorObj.id as string) || "",
      name: (authorObj.name as string) || "Anonyme",
      photo: (authorObj.profilThumbImageUrl as string) || null,
    };
  }

  // Fallback
  return {
    id: "",
    name: "Anonyme",
    photo: null,
  };
}

/**
 * Calcule le total des votes à partir d'un objet voteCount
 * @param voteCount - Objet contenant les compteurs de votes par type
 * @returns Le total de tous les votes
 */
export function calculateTotalVotes(voteCount?: Record<string, number> | null): number {
  if (!voteCount || typeof voteCount !== "object") return 0;
  return Object.values(voteCount).reduce((sum, count) => sum + count, 0);
}
