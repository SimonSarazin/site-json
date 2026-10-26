import { useMemo } from "react";
import { getBaseUrl } from "@/lib/constant/common";
import type { CoformResourceDirectorySectionProps } from "../schema";
import { useSearchQuery } from "./useSearchQuery";
import { useResourceParentsQuery } from "./useResourceParentsQuery";
import { canonicalSearchProStaticBaseParams } from "../lib/canonicalBaseParams";
import { getEntryId } from "../lib/searchMapSelection";
import {
  buildResourceDirectoryFilters,
  parseResourceDirectoryItem,
} from "../lib/resourceDirectory";

const RD_LIST_PREFIX = "resource-directory-list";
// L'éclatement « 1 salle = 1 réponse » de `getRessourceTL` fait qu'une page de N
// answers ≠ N cartes : on charge l'ensemble (un annuaire de ressources est borné).
const RD_PAGE_SIZE = 500;

/** Ce qu'il faut d'une section `coform-resource-directory` pour charger ses ressources. */
export type ResourceDirectorySource = Pick<
  CoformResourceDirectorySectionProps,
  "resourceTypes" | "finderSuffix" | "fieldSuffixes" | "costumSlug" | "contextId" | "contextType" | "scope" | "limit"
>;

/**
 * Paramètres de recherche de l'annuaire (variant `navigator-tl-ressource`) : filtre fixe des
 * formulaires + garde de zone, champs nécessaires à l'éclatement serveur des salles.
 */
export function buildResourceDirectoryBaseParams(src: ResourceDirectorySource): Record<string, unknown> {
  const addressLevel1 = src.scope?.addressLevel1;
  return {
    defaultTypes: ["answers"],
    defaultFilters: {
      ...buildResourceDirectoryFilters(src.resourceTypes, src.finderSuffix),
      ...(addressLevel1 ? { "address.level1": addressLevel1 } : {}),
    },
    // `form` : indispensable à l'éclatement serveur des salles et au filtre
    // prix par formulaire (`Navigator::getRessourceTL`).
    defaultFields: ["name", "description", "answers", "collection", "form"],
    indexStepList: Math.min(src.limit ?? RD_PAGE_SIZE, RD_PAGE_SIZE),
    notSourceKey: true,
    ...(src.costumSlug ? { costumSlug: src.costumSlug } : {}),
    ...(src.contextId ? { contextId: src.contextId } : {}),
    ...(src.contextType ? { contextType: src.contextType } : {}),
  };
}

/**
 * Ressources d'un annuaire, lues et résolues : UNE implémentation pour la section
 * `coform-resource-directory` et les suggestions de services du `hero-search` (même clé de requête :
 * le cache est partagé entre les deux). Lieux porteurs résolus pour TOUTES les ressources chargées.
 */
export function useResourceDirectoryItems(
  src: ResourceDirectorySource,
  opts: { serverFilters?: Record<string, unknown>; enabled?: boolean } = {},
) {
  const { resourceTypes, finderSuffix, fieldSuffixes, costumSlug, contextId, contextType } = src;
  const enabled = opts.enabled ?? true;

  const baseParams = useMemo(() => buildResourceDirectoryBaseParams(src), [src]);
  const mergedBaseParams = useMemo(
    () => canonicalSearchProStaticBaseParams(baseParams, opts.serverFilters ?? {}, {}),
    [baseParams, opts.serverFilters],
  );

  const { transformedResults, lastItemRef, isPending, isFetchingNextPage, error, refetch } = useSearchQuery({
    queryKeyPrefix: RD_LIST_PREFIX,
    searchText: "",
    searchTags: {},
    searchType: { type: ["answers"] },
    mapUsed: false,
    baseParams: mergedBaseParams,
    variant: "navigator-tl-ressource",
    enabled,
  });

  const parseOpts = useMemo(
    () => ({
      resourceTypes,
      finderSuffix,
      fieldSuffixes: { finder: finderSuffix, ...fieldSuffixes },
      baseUrl: getBaseUrl(),
    }),
    [resourceTypes, finderSuffix, fieldSuffixes],
  );

  // `getRessourceTL` éclate 1 salle = 1 réponse : plusieurs cartes partagent le
  // `_id` de l'answer source. On re-clé sur `_id` + `roomIndex` pour que les
  // clés React et le deep-link `?resource=` restent uniques (item léger : la
  // carte / le détail ne lisent que `serverData`).
  const items = useMemo(
    () =>
      transformedResults.map((r) => {
        const serverData = (r?.serverData ?? {}) as Record<string, unknown>;
        const model = parseResourceDirectoryItem(serverData, parseOpts);
        const baseId = getEntryId(r) ?? "";
        const uid = model.roomIndex ? `${baseId}-room${model.roomIndex}` : baseId;
        return {
          id: uid,
          serverData,
          getEntityType: () => "answers" as const,
          model,
        };
      }),
    [transformedResults, parseOpts],
  );

  // Lieux porteurs de TOUTES les ressources chargées (pas des seules affichées) : les filtres de zone et
  // de recherche s'y appliquent. `model.parent` = `resolveAnswerParent`, déjà résolu par le parseur.
  const parentIds = useMemo(
    () => items.map((it) => it.model.parent?.id).filter((v): v is string => !!v),
    [items],
  );
  const {
    parents,
    isLoading: parentsLoading,
    isError: parentsError,
    refetch: refetchParents,
  } = useResourceParentsQuery(parentIds, {
    costumSlug,
    contextId,
    contextType,
    enabled,
  });

  return {
    items,
    parents,
    parentsLoading,
    parentsError,
    refetchParents,
    lastItemRef,
    isPending,
    isFetchingNextPage,
    error,
    refetch,
  };
}
