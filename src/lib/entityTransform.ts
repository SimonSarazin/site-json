import Cocolight, { EntityTypes } from "@communecter/cocolight-api-client";

type CocolightHelper = typeof Cocolight.helper;

/**
 * Transforme un item en instance d'entité complète
 *
 * @param item - L'item à transformer (peut être déjà une instance ou un JSON brut)
 * @param helper - Le helper Cocolight pour la transformation
 * @param parentEntity - L'entité parente pour le contexte de transformation
 * @returns L'instance d'entité transformée
 */
export function transformToEntityInstance<T>(
  item: unknown,
  helper: CocolightHelper,
  parentEntity: EntityTypes
): T {
  // Si c'est déjà une instance d'entité avec la méthode getEntityType, on la garde
  if (item && typeof item === "object" && "getEntityType" in item) {
    return item as T;
  }

  // Sinon, on essaie de transformer via helper
  try {
    return helper.fromEntityJSON(item, parentEntity) as T;
  } catch {
    // Si la transformation échoue, on retourne l'item tel quel (cast via unknown)
    return item as unknown as T;
  }
}
