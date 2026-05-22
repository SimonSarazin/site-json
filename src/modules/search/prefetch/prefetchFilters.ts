import type { QueryClient } from "@tanstack/react-query";
import { getBaseUrl } from "@/lib/constant/common";
import { initApi } from "@/lib/apiClient";
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

/**
 * Section JSON minimaliste pour les helpers de découverte. Le schéma complet
 * est validé ailleurs (cf. `src/types/site-schema.ts`).
 */
interface RawSection {
  type: string;
  id?: string;
  props?: Record<string, unknown>;
}

/**
 * Registry d'extracteurs de sections imbriquées — mêmes containers que
 * `findSearchSections` (`src/lib/buildRoutes.tsx`). Toute extension d'un côté
 * doit être reportée de l'autre.
 */
const SECTION_EXTRACTORS: Record<string, (props: Record<string, unknown>) => unknown[]> = {
  gridLayout: (p) => [p.leftSection, p.rightSection],
  tabs: (p) =>
    (Array.isArray(p.tabs) ? p.tabs : []).flatMap((t: { content: unknown }) =>
      Array.isArray(t.content) ? t.content : []
    ),
};

/**
 * Recherche récursive des sections de type `filters` dans une arborescence de
 * sections (gridLayout, tabs, etc.).
 */
export function findFiltersSections(sections: RawSection[]): RawSection[] {
  const result: RawSection[] = [];
  for (const section of sections) {
    if (section.type === "filters") {
      result.push(section);
    } else if (SECTION_EXTRACTORS[section.type] && section.props) {
      const nested = SECTION_EXTRACTORS[section.type](section.props).filter(Boolean) as RawSection[];
      result.push(...findFiltersSections(nested));
    }
  }
  return result;
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

  try {
    return await queryClient.ensureQueryData({
      queryKey: searchZoneQueryKey(query, options),
      queryFn: async () => {
        const { entity, api } = await initApi({ baseURL: getBaseUrl() });
        const target = entity || api;
        if (!target || typeof (target as { searchZone?: unknown }).searchZone !== "function") {
          return [];
        }
        return fetchSearchZones(target as Parameters<typeof fetchSearchZones>[0], options);
      },
    });
  } catch (error) {
    console.error("Erreur préchargement zones:", error);
    return null;
  }
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

  try {
    return await queryClient.ensureQueryData({
      queryKey: filtersByAnswersQueryKey(query, options),
      queryFn: async () => {
        const { entity, api } = await initApi({ baseURL: getBaseUrl() });
        const target = entity || api;
        if (!target || typeof (target as { coformFiltersSearch?: unknown }).coformFiltersSearch !== "function") {
          return {};
        }
        return fetchFiltersByAnswers(target as Parameters<typeof fetchFiltersByAnswers>[0], options);
      },
    });
  } catch (error) {
    console.error("Erreur préchargement filtersByAnswers:", error);
    return null;
  }
}

/**
 * Helper haut niveau : pour une section `filters`, déclenche le préchargement
 * des deux dépendances (zones + filtersByAnswers) en parallèle.
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
      type?: string;
      config?: { countryCode?: string[]; level?: string[] };
    }>;
    filtersByAnswers?: FiltersByAnswersOptions;
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

  await Promise.all(tasks);
}
