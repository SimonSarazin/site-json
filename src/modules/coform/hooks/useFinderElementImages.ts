import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useCocolightOptional } from "@/hooks/useCocolight";
import { COFORM_QUERY_KEYS } from "../constants/queryKeys";
import type { FinderValue, FinderElement } from "../types";
import {
  RESOLVABLE_TYPES,
  ELEMENT_SUMMARY_STALE_TIME_MS,
  fetchElementSummary,
} from "./useElementSummary";

/**
 * Éléments d'un finder dont l'image n'est PAS stockée dans la réponse et dont
 * le type est résoluble côté SDK. C'est le cœur du fix : on ne dépend plus du
 * `img` figé au moment de la sélection (souvent absent en data legacy, ou
 * périmé si l'élément a changé d'avatar depuis) — on re-résout au runtime.
 *
 * Pur (testable) : `value` → liste d'éléments à enrichir.
 */
export function finderElementsNeedingImage(value: FinderValue): FinderElement[] {
  if (!value) return [];
  return Object.values(value).filter(
    (el) => !!el?.id && !el.img && RESOLVABLE_TYPES.has(el.type),
  );
}

/**
 * Fusionne les images résolues dans une copie d'affichage des éléments, SANS
 * muter la valeur RHF (la persistance garde son `img` d'origine — on ne veut
 * pas réécrire une URL absolue résolue au runtime dans la réponse).
 *
 * Pur (testable) : `value` + map `{id → url}` → éléments prêts à rendre.
 */
export function mergeResolvedFinderImages(
  value: FinderValue,
  resolved: Record<string, string>,
): FinderElement[] {
  if (!value) return [];
  return Object.values(value).map((el) =>
    el.img || !resolved[el.id] ? el : { ...el, img: resolved[el.id] },
  );
}

/**
 * Hook React Query : pour les éléments d'un finder dont l'image n'est pas
 * stockée dans la réponse, résout l'image de profil live via le SDK.
 *
 * Pourquoi : l'`img` n'est plus persistée ni lue depuis la réponse (elle se
 * périme — l'élément peut changer d'avatar) ; `formParser` la retire des deux
 * côtés du round-trip. La source de vérité est donc l'entité elle-même,
 * résolue ici à l'affichage — même modèle que la page "lieux".
 *
 * Caractéristiques :
 *  - Fetch les éléments d'une réponse chargée (leur `img` a été stripée au
 *    parse) ; **pas** ceux fraîchement sélectionnés (le modal leur pose une
 *    `img` transitoire d'aperçu, jamais persistée) → aucun re-fetch inutile.
 *  - Cache 5 min, clé `COFORM_QUERY_KEYS.ELEMENT_SUMMARY` **partagée** avec
 *    `useElementSummary` → un même élément résolu une seule fois (ex.
 *    `PlaceFormView` qui en lit le nom et la chip finder qui en lit l'image).
 *  - `auth: none` côté endpoint → marche en lecture seule et en mode anonyme.
 *  - Dégrade proprement hors `CocolightProvider` (tests) : aucune query.
 *  - **Ne mute jamais** la valeur RHF (cf. {@link mergeResolvedFinderImages}).
 *
 * @returns Map `{ elementId → url absolue }` pour les seuls éléments résolus.
 */
export function useFinderElementImages(value: FinderValue): Record<string, string> {
  const api = useCocolightOptional()?.api ?? null;

  const missing = useMemo(() => finderElementsNeedingImage(value), [value]);

  const results = useQueries({
    queries: missing.map((el) => ({
      queryKey: COFORM_QUERY_KEYS.ELEMENT_SUMMARY(el.type, el.id),
      enabled: !!api,
      staleTime: ELEMENT_SUMMARY_STALE_TIME_MS,
      queryFn: () => fetchElementSummary(api!, el.id, el.type),
    })),
  });

  return useMemo(() => {
    const out: Record<string, string> = {};
    missing.forEach((el, i) => {
      const url = results[i]?.data?.img;
      if (typeof url === "string" && url) out[el.id] = url;
    });
    return out;
    // `results` change d'identité à chaque render (tableau RQ) — dep volontaire,
    // le recompute est trivial (boucle sur quelques éléments).
  }, [missing, results]);
}
