import type { SearchEntity } from "@communecter/cocolight-api-client";
import type { FinderElementType, FinderSearchResult } from "../types";

/**
 * Transforme une instance d'entité SDK (User/Organization/Project/Event/Poi) en
 * `FinderSearchResult` plat consommable par l'UI Finder.
 *
 * **Important** : l'`entity` passée en argument doit être une instance SDK
 * (résultat de `helper.fromEntityJSON(json, parent)` ou item déjà transformé
 * par `searchCostum`). On lit `entity.id` (extrait par le SDK depuis `_id.$oid`
 * MongoDB EJSON) et `entity.serverData.*` (champs normalisés).
 *
 * En passant **toujours** par une instance SDK plutôt que du JSON brut, on
 * évite les extractions manuelles de `_id.$oid` et les fallbacks `_serverData`
 * vs `serverData` (cf. ancienne version inline dans `FinderSearchModal`).
 *
 * @param entity        Instance SDK transformée
 * @param fallbackType  Type à utiliser si `serverData.collection`/`type` sont absents
 */
export function toFinderSearchResult(
  entity: SearchEntity,
  fallbackType: FinderElementType,
): FinderSearchResult {
  const data = (entity.serverData ?? {}) as Record<string, unknown>;

  return {
    id: entity.id ?? "",
    name: typeof data.name === "string" ? data.name : "",
    type:
      (typeof data.collection === "string" && data.collection) ||
      (typeof data.type === "string" && data.type) ||
      fallbackType,
    profilThumbImageUrl:
      typeof data.profilThumbImageUrl === "string"
        ? data.profilThumbImageUrl
        : undefined,
    email: typeof data.email === "string" ? data.email : undefined,
    address:
      data.address && typeof data.address === "object"
        ? (data.address as FinderSearchResult["address"])
        : undefined,
  };
}
