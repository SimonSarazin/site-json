import { createContext } from "react";
import type { CommonTableCatalogs } from "../types";

/**
 * Contexte exposant les catalogues collaboratifs (lecture seule) des inputs
 * commonTable d'un formulaire. Voir `CommonTableCatalogsProvider` (composant)
 * et `useCommonTableCatalog` (hook).
 */
export const CommonTableCatalogsContext = createContext<CommonTableCatalogs>({});
