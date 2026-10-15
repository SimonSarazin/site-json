import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { ensureInitApi } from "@/lib/cocolightInitQuery";
import {
  searchZoneQueryKey,
  fetchSearchZones,
  type SearchZoneOptions,
} from "../hooks/useSearchZone";
import {
  filtersByAnswersQueryKey,
  fetchFiltersByAnswers,
  type FiltersByAnswersOptions,
} from "../hooks/useFiltersByAnswers";
import {
  filterEntitiesQueryKey,
  fetchFilterEntities,
  type FilterEntitiesOptions,
} from "../hooks/useFilterEntities";
import {
  filtersByPathQueryKey,
  fetchFilterByPathEntry,
  type FiltersByPathOptions,
} from "../hooks/useFiltersByPath";
import { enfantsDeSection, type SectionLike } from "@/lib/sectionContainers";
// Mémo serveur des facettes : un appel backend par facette et par durée de vie, pas par rendu.
// Les résultats de recherche (`prefetchSearchResults`) ne passent PAS par lui.
import { facetCache } from "./facetCache";

/**
 * Section JSON minimaliste pour les helpers de découverte. Le schéma complet
 * est validé ailleurs (cf. `src/types/site-schema.ts`).
 */
type RawSection = SectionLike & { id?: string };

/**
 * Recherche récursive des sections de type `filters` dans une arborescence de
 * sections (gridLayout, tabs, etc.).
 */
export function findFiltersSections(sections: RawSection[]): RawSection[] {
  const result: RawSection[] = [];
  for (const section of sections) {
    const props = (section.props ?? {}) as Record<string, unknown>;
    // Générique (pas de cas en dur par `type`) : toute section qui DÉCLARE une
    // config de filtres est préfetchée — la section `filters` classique OU une
    // section qui pilote les filtres via les mêmes props (ex. le hero de la home).
    // `prefetchFilterSection` lit déjà `props.*` sans regarder le type.
    if (props.filterGroups || props.filtersByAnswers || props.filtersByPath) {
      result.push(section);
    }
    // Les containers viennent du registre PARTAGÉ : la liste vivait ici ET dans
    // `sectionContainers.ts`, avec la consigne de reporter toute extension des deux côtés — un
    // container ajouté d'un seul côté serait raté silencieusement par l'autre parcours.
    result.push(...findFiltersSections(enfantsDeSection(section) as RawSection[]));
  }
  return result;
}

/**
 * Tronc commun des quatre facettes :
 *  1. l'entrée React Query que la page lira (`queryKey`, la même que le hook client) ;
 *  2. l'init API de la requête (`ensureInitApi`, partagée) et le garde-fou duck-typing sur la
 *     méthode du porteur (`entity` sinon `api`) ;
 *  3. le mémo serveur `facetCache`, dont la clé est `memoKey` : la facette et les paramètres de
 *     l'APPEL backend — jamais l'identifiant de section porté par la queryKey, pour que deux
 *     sections (ou deux pages) qui demandent la même facette partagent une seule entrée et un seul
 *     appel par durée de vie. `null` : `fetch` tient son propre mémo (filtersByPath, par entrée).
 * Best-effort : un échec est journalisé et rend `null`, le rendu continue sans la facette.
 */
async function prefetchFacet<V>(args: {
  queryClient: QueryClient;
  queryKey: QueryKey;
  /** Méthode du porteur requise (`searchZone`, `coformFiltersSearch`…). */
  method: string;
  /** Pour le journal d'erreur. */
  label: string;
  /** Valeur rendue quand aucun porteur n'offre `method`. */
  empty: V;
  /** Clé du mémo serveur (facette + paramètres d'appel), ou `null` si `fetch` mémorise lui-même. */
  memoKey: unknown[] | null;
  fetch: (target: unknown) => Promise<V>;
}): Promise<V | null> {
  const { queryClient, queryKey, method, label, empty, memoKey, fetch } = args;
  try {
    return await queryClient.ensureQueryData({
      queryKey,
      queryFn: async () => {
        const { entity, api } = await ensureInitApi(queryClient);
        const target = entity || api;
        if (!target || typeof (target as unknown as Record<string, unknown>)[method] !== "function") {
          return empty;
        }
        return memoKey ? facetCache.get(JSON.stringify(memoKey), () => fetch(target)) : fetch(target);
      },
    });
  } catch (error) {
    console.error(`Erreur préchargement ${label}:`, error);
    return null;
  }
}

/**
 * Pré-charge les zones (pays/régions…) pour le SSR — hydrate React Query
 * avec la même `queryKey` que `useSearchZoneQuery`.
 */
export async function prefetchSearchZones(
  queryClient: QueryClient,
  query: string,
  options: SearchZoneOptions
) {
  if (options.countryCode.length === 0 || options.level.length === 0) return null;
  return prefetchFacet({
    queryClient,
    queryKey: searchZoneQueryKey(query, options),
    method: "searchZone",
    label: "zones",
    empty: [] as Awaited<ReturnType<typeof fetchSearchZones>>,
    memoKey: ["zones", options],
    fetch: (target) => fetchSearchZones(target as Parameters<typeof fetchSearchZones>[0], options),
  });
}

/**
 * Pré-charge les filtres dérivés des Answers Coform pour le SSR — hydrate
 * React Query avec la même `queryKey` que `useFiltersByAnswersQuery`.
 */
export async function prefetchFiltersByAnswers(
  queryClient: QueryClient,
  query: string,
  options: FiltersByAnswersOptions
) {
  if (Object.keys(options).length === 0) return null;
  return prefetchFacet({
    queryClient,
    queryKey: filtersByAnswersQueryKey(query, options),
    method: "coformFiltersSearch",
    label: "filtersByAnswers",
    empty: {} as Awaited<ReturnType<typeof fetchFiltersByAnswers>>,
    memoKey: ["filters-by-answers", options],
    fetch: (target) => fetchFiltersByAnswers(target as Parameters<typeof fetchFiltersByAnswers>[0], options),
  });
}

/**
 * Pré-charge les entités d'un groupe de filtre `entityList` (réseaux régionaux…)
 * pour le SSR — hydrate React Query avec la même `queryKey` que
 * `useFilterEntitiesQuery`.
 */
export async function prefetchFilterEntities(
  queryClient: QueryClient,
  query: string,
  options: FilterEntitiesOptions,
  filterBy = "slug"
) {
  if (!options.defaultTypes?.length) return null;
  return prefetchFacet({
    queryClient,
    queryKey: filterEntitiesQueryKey(query, options),
    method: "searchCostum",
    label: "entités filtre",
    empty: [] as Awaited<ReturnType<typeof fetchFilterEntities>>,
    // `filterBy` n'entre pas dans la queryKey (même contrat que le client) mais change l'appel.
    memoKey: ["filter-entities", options, filterBy],
    fetch: (target) => fetchFilterEntities(target as Parameters<typeof fetchFilterEntities>[0], options, filterBy),
  });
}

/**
 * Pré-charge les filtres par thématique CoForm (`coformFilterByPath`) pour le
 * SSR — hydrate React Query avec la même `queryKey` que `useFiltersByPathQuery`.
 */
export async function prefetchFiltersByPath(
  queryClient: QueryClient,
  query: string,
  options: FiltersByPathOptions
) {
  if (Object.keys(options).length === 0) return null;
  return prefetchFacet({
    queryClient,
    queryKey: filtersByPathQueryKey(query, options),
    method: "coformFilterByPath",
    label: "filtersByPath",
    empty: {} as Record<string, Awaited<ReturnType<typeof fetchFilterByPathEntry>>>,
    // Mémo PAR ENTRÉE, posé avant le repli best-effort : une entrée en échec rejette et n'est pas
    // mémorisée (la suivante réessaie), les autres sont servies — l'agrégat `fetchFiltersByPath`
    // du client, lui, avale l'échec, ce qu'un mémo prendrait pour un succès à garder 5 min.
    memoKey: null,
    fetch: async (target) => {
      const entity = target as Parameters<typeof fetchFilterByPathEntry>[0];
      const resolved = await Promise.all(
        Object.entries(options).map(async ([key, opt]) => {
          try {
            return [key, await facetCache.get(JSON.stringify(["filters-by-path", opt]), () => fetchFilterByPathEntry(entity, opt))] as const;
          } catch (error) {
            console.error(`[prefetchFiltersByPath] échec pour "${key}":`, error);
            return [key, { label: opt.label, values: {} }] as const;
          }
        }),
      );
      return Object.fromEntries(resolved);
    },
  });
}

/**
 * Helper haut niveau : pour une section `filters`, déclenche le préchargement
 * des dépendances (zones + filtersByAnswers + filtersByPath + entityList) en parallèle.
 *
 * Les paramètres dérivés des `filterGroups[type="scopeList"]` sont fusionnés
 * en une seule requête zone (cohérent avec `FiltersSection.tsx` côté client).
 */
export async function prefetchFilterSection(
  queryClient: QueryClient,
  section: RawSection
) {
  const props = (section.props ?? {}) as {
    filterGroups?: Array<{
      id?: string;
      type?: string;
      config?: { countryCode?: string[]; level?: string[] };
      baseParams?: FilterEntitiesOptions;
      filterBy?: string;
    }>;
    filtersByAnswers?: FiltersByAnswersOptions;
    filtersByPath?: FiltersByPathOptions;
  };
  const sectionId = section.id ?? "anonymous";

  const tasks: Array<Promise<unknown>> = [];

  // Zones : fusionne tous les scopeList groups (countryCode + level dédupliqués).
  const scopeGroups = (props.filterGroups ?? []).filter((g) => g.type === "scopeList");
  if (scopeGroups.length > 0) {
    const countryCode = Array.from(
      new Set(scopeGroups.flatMap((g) => g.config?.countryCode ?? []))
    );
    const level = Array.from(new Set(scopeGroups.flatMap((g) => g.config?.level ?? [])));
    tasks.push(
      prefetchSearchZones(queryClient, `filters-zone-${sectionId}`, { countryCode, level })
    );
  }

  // filtersByAnswers : un seul call backend agrège tous les filtres déclarés.
  if (props.filtersByAnswers && Object.keys(props.filtersByAnswers).length > 0) {
    tasks.push(
      prefetchFiltersByAnswers(
        queryClient,
        `filters-answers-${sectionId}`,
        props.filtersByAnswers
      )
    );
  }

  // filtersByPath : un appel coformFilterByPath par entrée.
  if (props.filtersByPath && Object.keys(props.filtersByPath).length > 0) {
    tasks.push(
      prefetchFiltersByPath(
        queryClient,
        `filters-by-path-${sectionId}`,
        props.filtersByPath
      )
    );
  }

  // entityList : un prefetch par groupe (chacun a ses propres baseParams).
  const entityGroups = (props.filterGroups ?? []).filter(
    (g) => g.type === "entityList" && g.baseParams
  );
  for (const g of entityGroups) {
    tasks.push(
      prefetchFilterEntities(
        queryClient,
        `filters-entities-${sectionId}-${g.id ?? "anonymous"}`,
        g.baseParams!,
        g.filterBy ?? "slug"
      )
    );
  }

  await Promise.all(tasks);
}
