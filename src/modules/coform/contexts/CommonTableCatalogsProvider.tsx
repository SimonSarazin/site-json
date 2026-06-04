import { type ReactNode } from "react";
import { CommonTableCatalogsContext } from "./CommonTableCatalogsContext";
import type { CommonTableCatalogs } from "../types";

interface ProviderProps {
  catalogs: CommonTableCatalogs;
  children: ReactNode;
}

/**
 * Pose les catalogues collaboratifs commonTable dans l'arbre React. Posé par
 * `SmartCoForm` après le fetch batch via `useCoFormCatalogs`. Si le formulaire
 * ne contient pas d'input commonTable, `catalogs` sera vide — c'est un no-op.
 */
export function CommonTableCatalogsProvider({ catalogs, children }: ProviderProps) {
  return (
    <CommonTableCatalogsContext.Provider value={catalogs}>
      {children}
    </CommonTableCatalogsContext.Provider>
  );
}
