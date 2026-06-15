import { useContext } from "react";
import { CommonTableCatalogsContext } from "../contexts/CommonTableCatalogsContext";
import type { CommonTableCatalog } from "../types";

/**
 * Récupère le catalogue collaboratif (lecture seule) pour un input commonTable
 * donné. Retourne un objet vide si aucun catalogue n'est posé (formulaire sans
 * commonTable, ou loading).
 */
export function useCommonTableCatalog(inputKey: string): CommonTableCatalog {
  const all = useContext(CommonTableCatalogsContext);
  return all[inputKey] ?? {};
}
