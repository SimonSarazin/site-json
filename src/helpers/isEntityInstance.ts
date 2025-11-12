import type { SearchEntity } from "@/modules/search/schema";

/**
 * Type guard pour vérifier si les données sont une instance d'entité
 * (avec méthode getEntityType) ou du JSON déshydraté
 */
export function isEntityInstance(data: unknown): data is SearchEntity {
  return (
    data != null &&
    typeof data === 'object' &&
    'getEntityType' in data &&
    typeof (data as Record<string, unknown>).getEntityType === 'function'
  );
}