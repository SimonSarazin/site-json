import { createContext } from "react";
import type { NewsContextType } from "../types";

/**
 * Context pour le module News
 *
 * Fournit les données et configuration nécessaires aux composants news
 * sans dépendance vers le module profil.
 */

export const NewsContext = createContext<NewsContextType | undefined>(undefined);