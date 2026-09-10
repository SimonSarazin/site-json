/**
 * Options et décomptes des facettes de l'annuaire.
 *
 * ## Pourquoi une requête à part
 *
 * Les facettes se calculent sur le jeu **NON filtré**. Les dériver du listing
 * courant ferait disparaître une option dès qu'on la coche — l'utilisateur se
 * retrouverait enfermé dans sa propre sélection, sans moyen de la corriger
 * autrement que par « Effacer ».
 *
 * C'est aussi la structure du legacy, qui lance pour cela une seconde requête à
 * `indexStep: "0"` (`setThemesCounts`) et compte dans le navigateur.
 *
 * ## Pourquoi une projection étroite
 *
 * `fields: ["collection", "answers"]` — deux effets, tous deux voulus :
 *  - `buildUsageTree` et `countTagFacets` ne lisent QUE `answers`, rien d'autre
 *    n'est utile ici ;
 *  - `parsePropositionData` lit `form`/`user`/`context`/`project` **sur le
 *    document projeté** pour alimenter les dix blocs latéraux. Les omettre rend
 *    les dix requêtes Mongo annexes triviales — la projection étroite est donc
 *    aussi ce qui rend cette passe légère.
 *
 * L'arbre « Filtrer par besoins » n'appelle rien de plus : `Aap::getUsageAnswers`
 * n'est pas une route HTTP mais une méthode exécutée au rendu du widget legacy,
 * et elle ne lit que `form.params` et les réponses — que nous avons déjà
 * (cf. `lib/aacUsage.ts`).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Form } from "@communecter/cocolight-api-client";
import { AAC_QUERY_KEYS } from "../constants/queryKeys";
import { fetchAacCommunsPage, AAC_SCAN_SIZE } from "../lib/communsTransport";
import { EMPTY_AAC_FILTERS } from "../lib/filtersKey";
import { PUBLIC_AAC_VISIBILITY, type AacVisibility } from "../lib/aacQueryParams";
import { buildUsageTree, countTagFacets, readUsageLabels, type AacUsageOption } from "../lib/aacUsage";
import type { AacCardFields } from "../lib/resolveAacCardFields";

export interface UseAacFacetsParams {
  formId: string | null;
  /** L'instance `Form` rattachée à l'entité costum (cf. `useAacFormEntity`). */
  form: Form | null;
  fields: AacCardFields | null;
  /** `form.params`, pour les libellés exacts d'usage. Facultatif. */
  formParams?: unknown;
  campaignId?: string | null;
  contextId?: string | null;
  baseUrl?: string;
  /**
   * Qui regarde. Les décomptes portent sur la population VISIBLE : un anonyme ne
   * doit pas voir des facettes alimentées par des communs non sélectionnés.
   */
  visibility?: AacVisibility;
  /**
   * Fausse ⇒ aucun balayage. Une surface sans colonne de filtres (l'aperçu de
   * la page d'accueil) n'a rien à faire des facettes : les calculer coûterait
   * une requête de 300 communs pour des options que personne ne verra.
   */
  enabled?: boolean;
}

export interface UseAacFacetsResult {
  usageTree: AacUsageOption[];
  tagOptions: { id: string; label: string; count: number }[];
  isLoading: boolean;
  error: Error | null;
  /** Le balayage a atteint sa borne : les décomptes sont des MINORANTS. */
  truncated: boolean;
}

/** Projection minimale pour compter les facettes — cf. l'en-tête. */
const FACET_FIELDS = ["collection", "answers"];

export function useAacFacets({
  formId,
  form,
  fields,
  formParams,
  campaignId = null,
  contextId = null,
  baseUrl = "",
  visibility = PUBLIC_AAC_VISIBILITY,
  enabled = true,
}: UseAacFacetsParams): UseAacFacetsResult {
  const { data, isLoading, error } = useQuery({
    queryKey: AAC_QUERY_KEYS.FACETS(formId, campaignId, visibility.currentUserId),
    queryFn: () => {
      if (!form || !fields) throw new Error("AAC : formulaire ou champs non résolus");
      return fetchAacCommunsPage({
        form,
        fields,
        filters: EMPTY_AAC_FILTERS,
        page: 0,
        pageSize: AAC_SCAN_SIZE,
        contextId,
        baseUrl,
        projection: FACET_FIELDS,
        visibility,
      });
    },
    enabled: enabled && !!formId && !!form && !!fields,
    staleTime: 5 * 60 * 1000,
  });

  const communs = useMemo(() => data?.communs ?? [], [data?.communs]);

  const usageLabels = useMemo(() => readUsageLabels(formParams), [formParams]);

  const usageTree = useMemo(
    () => buildUsageTree(communs.map((c) => c.usage), usageLabels),
    [communs, usageLabels]
  );

  const tagOptions = useMemo(() => countTagFacets(communs), [communs]);

  return {
    usageTree,
    tagOptions,
    isLoading,
    error: (error as Error) ?? null,
    truncated: data?.truncated ?? false,
  };
}
