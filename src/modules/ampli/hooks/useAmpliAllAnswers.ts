import { useEffect } from "react";
import { useFetchAnswerQuery, type UseFetchAnswerQueryParams } from "./useFetchAnswerQuery";

/**
 * Plafond de sécurité : au-delà, on ARRÊTE d'enchaîner les pages (un coform mal
 * borné ne doit pas aspirer un index entier dans le navigateur).
 */
export const AMPLI_ALL_ANSWERS_DEFAULT_MAX = 5000;

/** Référence STABLE pour l'absence de résultats — un `[]` recréé à chaque rendu
 *  invaliderait tous les `useMemo` des consommateurs. */
const EMPTY_RESULTS: unknown[] = [];

export interface UseAmpliAllAnswersParams {
  coformId: string;
  baseParams?: UseFetchAnswerQueryParams["baseParams"];
  extractionConfig?: UseFetchAnswerQueryParams["extractionConfig"];
  /** `false` → aucun appel réseau (vue carte/split non affichée). */
  enabled?: boolean;
  maxResults?: number;
}

/**
 * Charge le périmètre COMPLET des réponses d'un coform (toutes les pages) —
 * pour les vues qui ont besoin de l'ensemble du jeu de données (carte, split),
 * par opposition à l'infinite-scroll de `useFetchAnswerQuery` (vue annuaire).
 *
 * Transposition stricte de `useSearchAllResults` (module search) au flux
 * `coformAnswersSearch` : pages enchaînées SÉQUENTIELLEMENT (le paginator du
 * SDK est séquentiel par contrat — le curseur de chaque page dérive de la
 * précédente), donc une seule requête en vol, pas de rafale sur le backend. Le
 * rendu est PROGRESSIF : `results` grossit à chaque page et `total` est connu
 * dès la première → barre de progression (`MapProgress`) côté UI.
 */
export function useAmpliAllAnswers({
  coformId,
  baseParams,
  extractionConfig,
  enabled = true,
  maxResults = AMPLI_ALL_ANSWERS_DEFAULT_MAX,
}: UseAmpliAllAnswersParams) {
  const {
    transformedResults,
    totalCount,
    isLoading,
    isPending,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchNextPageError,
    isFetchingNextPage,
  } = useFetchAnswerQuery({
    coformId,
    // Une SEULE clé de cache pour carte et split : les deux vues demandent le
    // même périmètre complet, basculer de l'une à l'autre doit être instantané.
    view: "map",
    baseParams,
    extractionConfig,
    enabled,
    // Cache LONG (repris de `useSearchAllResults`) : recharger cette vue =
    // re-chaîner TOUTES les pages séquentiellement. Avec le défaut de 60 s, un
    // simple aller-retour Annuaire ↔ Carte relancerait la cascade entière.
    cache: { staleTime: 30 * 60 * 1000, gcTime: 60 * 60 * 1000 },
  });

  const results = transformedResults ?? EMPTY_RESULTS;
  const loaded = results.length;
  const capped = loaded >= maxResults;

  // Chargement total : tant qu'il reste une page (et sous le plafond), on
  // enchaîne. Une page à la fois — cf. le commentaire de tête.
  useEffect(() => {
    // `isFetchNextPageError` est la condition d'ARRÊT : sur échec définitif
    // d'une page (après les 3 retries de react-query), la query garde ses pages
    // et repasse isFetchingNextPage à false SANS que `loaded` bouge, ce qui est
    // indiscernable d'un rendu de succès pour les autres gardes → l'effet
    // relancerait `fetchNextPage` en boucle, indéfiniment et sans rien afficher.
    if (enabled && hasNextPage && !capped && !isFetchingNextPage && !isLoading && !isFetchNextPageError) {
      void fetchNextPage();
    }
    // `loaded` est INDISPENSABLE dans les deps : après chaque page, les booléens
    // reviennent à des valeurs IDENTIQUES au run précédent → sans lui, React ne
    // voit aucun changement, saute l'effet, et la chaîne se fige à la page 2
    // (même piège que `useSearchAllResults`).
  }, [
    enabled,
    hasNextPage,
    capped,
    isFetchingNextPage,
    isLoading,
    isFetchNextPageError,
    fetchNextPage,
    loaded,
  ]);

  useEffect(() => {
    if (import.meta.env.DEV && capped && hasNextPage) {
      console.warn(
        `[useAmpliAllAnswers:${coformId}] plafond maxResults=${maxResults} atteint — ` +
          `chargement interrompu (total annoncé : ${totalCount ?? "?"})`,
      );
    }
  }, [capped, hasNextPage, maxResults, coformId, totalCount]);

  return {
    results,
    /** Nombre de réponses chargées jusqu'ici (progressif). */
    loaded,
    /** Total annoncé par le backend (connu dès la 1ʳᵉ page), sinon null. */
    total: totalCount ?? null,
    /** Vrai quand la chaîne est TERMINÉE : tout chargé, plafonné, ou arrêtée
     *  par un échec. Sans le cas d'échec, l'UI resterait sur son squelette de
     *  chargement pour toujours. */
    isComplete: !isLoading && (!hasNextPage || capped || isFetchNextPageError),
    /** Vrai si l'arrêt vient du plafond `maxResults`. */
    capped,
    /** Vrai si l'arrêt vient d'un échec de page — le périmètre est PARTIEL. */
    isPartial: Boolean(isFetchNextPageError),
    isLoading,
    isPending,
    isFetchingNextPage,
    error,
  };
}
