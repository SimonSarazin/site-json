import type { RouteObject } from "react-router";
import { SiteRenderer } from '@/components/SiteRenderer';
import type { SiteConfig } from "@/types/site";
import RootLayout from "@/RootLayout";
import type { QueryClient } from "@tanstack/react-query";
import type { LoaderFunctionArgs } from "react-router";
import { discoverModules, getModuleRoutes, getModuleRoutesSync } from "./modules";
import {
  prefetchSearchResults,
  findFiltersSections,
  prefetchFilterSection,
  prefetchFiltersByPath,
} from "@/modules/search/prefetch";
import type { FiltersByPathOptions } from "@/modules/search/hooks/useFiltersByPath";
import { canonicalSearchProStaticBaseParams } from "@/modules/search/lib/canonicalBaseParams";
import { observatoryPrefetchParams } from "@/modules/observatoire/prefetch";

/**
 * Helper pour parser les paramètres JSON depuis l'URL
 */
function parseJSON(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Registry des extracteurs de sections imbriquées
 * Pour ajouter un nouveau container : ajouter 1 ligne ici
 */
const SECTION_EXTRACTORS: Record<string, (props: Record<string, unknown>) => unknown[]> = {
  gridLayout: (p) => [p.leftSection, p.rightSection],
  tabs: (p) => (Array.isArray(p.tabs) ? p.tabs : []).flatMap((t: { content: unknown }) => Array.isArray(t.content) ? t.content : []),
};

/**
 * Recherche récursive des sections de recherche (searchPro/searchProStatic)
 * Utilise SECTION_EXTRACTORS pour gérer les containers
 */
function findSectionsOfTypes(
  sections: Array<{ type: string; props?: Record<string, unknown> }>,
  types: ReadonlySet<string>
): Array<{ type: string; props?: Record<string, unknown> }> {
  const result: Array<{ type: string; props?: Record<string, unknown> }> = [];

  for (const section of sections) {
    // Section ciblée directe
    if (types.has(section.type)) {
      result.push(section);
    }
    // Container avec sections imbriquées
    else if (SECTION_EXTRACTORS[section.type] && section.props) {
      const nested = SECTION_EXTRACTORS[section.type](section.props)
        .filter(Boolean) as Array<{ type: string; props?: Record<string, unknown> }>;
      result.push(...findSectionsOfTypes(nested, types));
    }
  }

  return result;
}

const SEARCH_SECTION_TYPES = new Set(['searchPro', 'searchProStatic']);
const OBSERVATORY_SECTION_TYPES = new Set(['data-observatory']);

function findSearchSections(
  sections: Array<{ type: string; props?: Record<string, unknown> }>
): Array<{ type: string; props?: Record<string, unknown> }> {
  return findSectionsOfTypes(sections, SEARCH_SECTION_TYPES);
}

/**
 * Construit l'arborescence de routes pour React Router v7 à partir :
 * 1. De la configuration JSON ‹pages› (routes du site config)
 * 2. Des routes des modules découverts automatiquement
 *
 * Le layout racine (<RootLayout/>) entoure toutes les pages et fournit les providers globaux.
 *
 * IMPORTANT : Cette fonction retourne soit :
 * - RouteObject[] (synchrone) : côté client sans queryClient + modules core uniquement
 * - Promise<RouteObject[]> (asynchrone) : côté serveur avec queryClient ou modules optional
 *
 * @param cfg - Configuration du site (pages, header, footer, etc.)
 * @param queryClient - Client React Query pour le pré-chargement SSR
 * @returns Routes React Router v7 (sync ou async selon le contexte)
 */
export function buildRoutes(cfg: SiteConfig, queryClient?: QueryClient): RouteObject[] | Promise<RouteObject[]> {
  // Découvrir les modules
  const modules = discoverModules();
  const hasOptional = modules.some(m => m.config.type === "optional");

  // MODE SYNCHRONE : Côté client sans queryClient + modules core uniquement
  if (!queryClient && !hasOptional) {
    // 1. Routes depuis la config JSON (sans loaders côté client)
    const configRoutes: RouteObject[] = cfg.pages.map((p) => ({
      path: p.path.replace(/^\/+/, ""),
      element: <SiteRenderer />,
      // Pas de loader côté client (pas de queryClient)
    }));

    // 2. Routes des modules core (synchrone)
    const moduleRoutes = getModuleRoutesSync(modules, undefined, cfg);

    // 3. Combiner toutes les routes
    const children: RouteObject[] = [
      ...configRoutes,
      ...moduleRoutes,
      { path: "*", element: <SiteRenderer /> },
    ];

    // 4. Route root
    return [
      {
        path: "/",
        element: <RootLayout config={cfg} />,
        children,
      },
    ];
  }

  // MODE ASYNCHRONE : Côté serveur avec queryClient ou modules optional
  return buildRoutesAsync(cfg, queryClient, modules);
}

/**
 * Version asynchrone de buildRoutes
 * Utilisée côté serveur (SSR) ou quand il y a des modules optional
 */
async function buildRoutesAsync(
  cfg: SiteConfig,
  queryClient: QueryClient | undefined,
  modules: ReturnType<typeof discoverModules>
): Promise<RouteObject[]> {
  // 1. Routes depuis la config JSON du site
  const configRoutes: RouteObject[] = cfg.pages.map((p) => ({
    path: p.path.replace(/^\/+/, ""),   // "about" au lieu de "/about"
    element: <SiteRenderer />,            // le rendu piloté par JSON
    loader: async ({ request }: LoaderFunctionArgs) => {
      // Si pas de queryClient, skip le pré-chargement (côté client)
      if (!queryClient) return null;

      // Parser les paramètres URL pour SearchPro
      const url = new URL(request.url);
      const searchParams = {
        q: url.searchParams.get('q') || '',
        tags: (parseJSON(url.searchParams.get('tags')) as Record<string, string[]>) || {},
        type: (parseJSON(url.searchParams.get('type')) as Record<string, string[]>) || {},
        map: url.searchParams.get('map') !== 'false',
      };

      // Détecter les sections searchPro/searchProStatic (y compris dans gridLayout, tabs, etc.)
      const searchSections = findSearchSections(p.sections);

      // Détecter les sections `filters` (zones + filtersByAnswers) pour les
      // précharger en parallèle des résultats de recherche. Réduit le LCP
      // côté client (les filtres apparaissent dès l'hydratation).
      const filterSections = findFiltersSections(p.sections);
      const filterPrefetch = Promise.all(
        filterSections.map((section) => prefetchFilterSection(queryClient, section))
      );

      // Pré-charger les résultats pour chaque section de recherche      console.log(`[SSR Prefetch] Found ${searchSections.length} search sections to prefetch`);
      const searchPrefetch = Promise.all(
        searchSections.map(async (section: { type: string; props?: Record<string, unknown> }) => {
          const props = section.props || {};
          const baseParams = (props.baseParams as Record<string, unknown>) || {};
          const queryKeyPrefix = section.type === 'searchPro'
            ? 'searchCostum'
            : 'searchCostumStatic';
          const searchVariant = props.searchVariant as string | undefined;

          // Pour searchProStatic, ne pas utiliser les params URL
          const params = section.type === 'searchPro'
            ? searchParams
            : {
                q: '',
                tags: {},
                type: baseParams.defaultTypes
                  ? { type: baseParams.defaultTypes as string[] }
                  : null,
                map: (props.showMap as boolean) || false,
              };

          // Aligner le shape de baseParams avec celui produit côté client par
          // `SearchProStatic.mergedBaseParams`. Sans ça la queryKey diffère et
          // le cache RQ est manqué post-hydratation → refetch inutile.
          // Cf. `canonicalSearchProStaticBaseParams` (source unique).
          const ssrBaseParams = section.type === 'searchProStatic'
            ? canonicalSearchProStaticBaseParams(baseParams)
            : baseParams;

          return prefetchSearchResults(queryClient, {
            queryKeyPrefix,
            searchText: params.q,
            searchTags: params.tags,
            searchType: params.type,
            mapUsed: params.map,
            baseParams: ssrBaseParams,
            variant: searchVariant,
          });
        })
      );

      // Pré-charger la PREMIÈRE page du dashboard observatoire (section
      // data-observatory) : même queryKey que le client (params construits
      // par le module observatoire) → dashboard plein au premier paint, les
      // pages suivantes s'enchaînent côté client après hydratation.
      const observatoryPrefetch = Promise.all(
        findSectionsOfTypes(p.sections, OBSERVATORY_SECTION_TYPES)
          .map((section) => observatoryPrefetchParams(section.props))
          .filter((params): params is NonNullable<typeof params> => params !== null)
          .map((params) => prefetchSearchResults(queryClient, params))
      );

      // Pré-charger les filtres thématiques (vue "thematics" de searchProStatic,
      // page réseaux thématiques) : même queryKey/options que `ThematicCards`
      // (`useFiltersByPathQuery`) pour un cache RQ hydraté dès le SSR.
      type ThematicSrc = FiltersByPathOptions[string];
      const thematicPrefetch = Promise.all(
        searchSections
          .map((s) => (s.props?.thematicSource as ThematicSrc | undefined))
          .filter((src): src is ThematicSrc => !!src)
          .map((src) =>
            prefetchFiltersByPath(queryClient, src.id ?? src.thematicPath, { thematic: src })
          )
      );

      // Attendre filtres + résultats en parallèle. Si l'un échoue, on n'empêche
      // pas l'autre — chaque prefetch a son propre try/catch interne.
      await Promise.all([filterPrefetch, searchPrefetch, thematicPrefetch, observatoryPrefetch]);
      return null;
    },
  }));

  // 2. Récupérer les routes des modules (async)
  const moduleRoutes = await getModuleRoutes(modules, queryClient, cfg);

  // 3. Combiner toutes les routes : config + modules + 404
  const children: RouteObject[] = [
    ...configRoutes,
    ...moduleRoutes,
    // route 404 interne (dernier recours)
    { path: "*", element: <SiteRenderer /> },
  ];

  // 4. Route root qui encapsule tout avec RootLayout
  return [
    {
      path: "/",              // correspond à la racine du site
      element: <RootLayout config={cfg} />,  // ThemeProvider + Providers + <Outlet/>
      children,
    },
  ];
}

