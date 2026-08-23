
import { resolveServerDataPath } from "./dropdownFilters";
import type { ResourceConf, SearchListEntity } from "../schema";

/**
 * Écarte une diapositive sans titre exploitable (POI mal renseigné) avant le rendu, plutôt que
 * d'afficher un slide vide. Lit le même champ que `useResourceData` (`titleField`, repli "name"),
 * mais SANS passer par le hook — cette fonction filtre la liste dans le composant parent, où
 * appeler `useResourceData` par item violerait les règles des hooks (nombre d'appels variable).
 */
export function hasRenderableTitle(item: SearchListEntity, resource: ResourceConf | undefined): boolean {
  const serverData = (item as { serverData?: Record<string, unknown> } | undefined)?.serverData;
  const value = resolveServerDataPath(serverData, resource?.titleField ?? "name");
  return typeof value === "string" ? value.trim().length > 0 : typeof value === "number";
}
