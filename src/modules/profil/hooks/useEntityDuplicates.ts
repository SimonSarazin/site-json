import { useState } from "react";
import type { SearchEntity } from "@communecter/cocolight-api-client";

import { useDebounce } from "@/hooks/useDebounce";
import { SEARCH_DUPLICATES_PREFIX } from "@/modules/search/constants";
import { useSearchQuery } from "@/modules/search/hooks/useSearchQuery";

import type { DuplicateBaseParams } from "../lib/duplicateSearch";
import { toSearchTerm } from "../lib/duplicateSearch";
import { DUPLICATE_DISPLAY_LIMIT, DUPLICATE_MIN_CHARS, isSearchableName, rankDuplicates, stillRelevant, type RankedDuplicate } from "../lib/entityDuplicates";

export interface UseEntityDuplicatesParams {
  /** Nom en cours de saisie. */
  name: unknown;
  /** Code postal en cours de saisie — sert au CLASSEMENT, jamais à la requête. */
  postalCode?: unknown;
  /** Périmètre résolu (`buildDuplicateBaseParams`) ; `null` = périmètre introuvable, on ne cherche pas. */
  baseParams: DuplicateBaseParams | null;
  /** `false` coupe tout (édition, formulaire non concerné). */
  active: boolean;
  minChars?: number;
  limit?: number;
  /** Entité à écarter des résultats (soi-même, si l'édition est un jour couverte). */
  excludeId?: string | null;
}

export interface EntityDuplicatesState {
  matches: RankedDuplicate<SearchEntity>[];
  /** Nombre de correspondances REÇUES, avant bornage à `limit`. */
  found: number;
  /** Le serveur en a d'autres au-delà de celles reçues : `found` est un plancher, pas un total. */
  hasMore: boolean;
  isLoading: boolean;
  isError: boolean;
  /** Une recherche a été demandée pour le nom courant (seuil atteint, périmètre connu). */
  isSearched: boolean;
}

const NO_TAGS: Record<string, string[]> = {};
const NO_RESULTS: SearchEntity[] = [];
const DEBOUNCE_MS = 400;
/**
 * Fraîcheur du cache. En wizard le slot est DÉMONTÉ puis remonté à chaque changement d'étape, et
 * React Query relance au montage toute requête périmée : avec le défaut du site (60 s), arriver à
 * l'étape « adresse » après avoir rempli l'étape « nom » refaisait la même requête de 50
 * résultats. Cinq minutes couvrent la saisie d'un formulaire sans figer le résultat.
 */
const STALE_MS = 5 * 60 * 1000;

/**
 * Entités existantes dont le nom approche celui en cours de saisie, classées du plus au moins
 * probant. Une seule requête par nom STABILISÉ (debounce 400 ms) — la lib n'annule pas une requête
 * en vol, chaque valeur coûte un aller-retour complet, d'où le seuil de caractères et le debounce.
 *
 * Le code postal ne part PAS au serveur : il changerait la clé de cache à chaque saisie d'adresse
 * et masquerait les homonymes des autres communes. Il ne sert qu'au classement, sur les résultats
 * déjà reçus — saisir une adresse ne déclenche donc aucune requête.
 */
export function useEntityDuplicates({
  name,
  postalCode,
  baseParams,
  active,
  minChars = DUPLICATE_MIN_CHARS,
  limit = DUPLICATE_DISPLAY_LIMIT,
  excludeId,
}: UseEntityDuplicatesParams): EntityDuplicatesState {
  const dName = useDebounce(typeof name === "string" ? name : "", DEBOUNCE_MS);
  const dPostal = useDebounce(postalCode, DEBOUNCE_MS);
  // Seuil appliqué à la valeur DEBOUNCÉE et repliée : sous le seuil, `searchText` reste vide — pas
  // de clé de cache par frappe.
  const searchable = active && baseParams !== null && isSearchableName(dName, minChars);
  const term = searchable ? toSearchTerm(dName) : "";

  const { transformedResults, isLoading, error, hasNextPage } = useSearchQuery({
    queryKeyPrefix: SEARCH_DUPLICATES_PREFIX,
    searchText: term,
    searchTags: NO_TAGS,
    // `searchType` explicite : à `null`, `defaultTypes` n'est jamais lu et aucune requête ne part.
    searchType: searchable && baseParams ? { type: baseParams.defaultTypes } : null,
    mapUsed: false,
    enabled: searchable,
    baseParams: baseParams ?? undefined,
    cache: { staleTime: STALE_MS },
  });

  // Chaque nom cherché a SA clé de cache : pendant qu'il charge, il n'a encore aucun résultat, et
  // le panneau disparaîtrait à chaque pause de frappe pour réapparaître 300 ms plus tard. On garde
  // donc les derniers résultats REÇUS, le temps du chargement — ceux qui ont encore un rapport avec
  // la saisie seulement (`stillRelevant`), et rien du tout après un passage sous le seuil : sans ces
  // deux gardes, effacer « La Fabrique » puis taper « Zèbre » réaffichait les fiches « La Fabrique ».
  // État ajusté pendant le rendu (et non dans un effet) : pas de rendu intermédiaire avec une liste vide.
  const [received, setReceived] = useState<SearchEntity[]>(NO_RESULTS);
  const fresh = transformedResults ?? NO_RESULTS;
  if (!searchable) {
    if (received !== NO_RESULTS) setReceived(NO_RESULTS);
  } else if (!isLoading && fresh !== received) {
    setReceived(fresh);
  }
  const shown = !searchable ? NO_RESULTS : isLoading ? stillRelevant(dName, received) : fresh;

  const ranked = rankDuplicates({ name: dName, postalCode: dPostal }, shown, { limit: Number.MAX_SAFE_INTEGER, excludeId });

  return {
    matches: ranked.slice(0, Math.max(0, limit)),
    found: ranked.length,
    hasMore: searchable && !isLoading && Boolean(hasNextPage),
    // `isPending` reste vrai sur une requête désactivée : l'état de chargement vient d'`isLoading`.
    isLoading: searchable && isLoading,
    isError: searchable && Boolean(error),
    isSearched: searchable,
  };
}
