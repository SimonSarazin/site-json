import type { RouteObject } from "react-router";
import { SiteRenderer } from '@/components/SiteRenderer';
import type { SiteConfig } from "@/types/site";
import RootLayout from "@/RootLayout";
import type { QueryClient } from "@tanstack/react-query";
import type { LoaderFunctionArgs } from "react-router";
import { getBaseUrl } from "./constant/common";
import { initApi } from "./apiClient";
import { discoverModules, getModuleRoutes, getModuleRoutesSync } from "./modules";

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
 * Fonction de préchargement des résultats de recherche pour le SSR
 */
async function prefetchSearchResults(
  queryClient: QueryClient,
  params: {
    queryKeyPrefix: string;
    searchText: string;
    searchTags: Record<string, string[]>;
    searchType: Record<string, string[]> | null;
    mapUsed: boolean;
    baseParams: Record<string, unknown>;
  }
) {
  const queryKey = [
    params.queryKeyPrefix,
    params.searchText,
    JSON.stringify(params.searchTags),
    JSON.stringify(params.searchType),
    params.mapUsed,
    JSON.stringify(params.baseParams),
  ];

  try {
    return await queryClient.ensureQueryData({
      queryKey,
      queryFn: async () => {
        const { organization, entity, api } = await initApi({
          baseURL: getBaseUrl(),
          debug: true
        });

        const searchContext = organization || entity || api;

        if (!searchContext?.searchCostum) {
          console.warn("searchCostum non disponible");
          return {
            pages: [{
              results: [],
              count: {},
              hasNext: false,
              pageNumber: 1
            }],
            pageParams: [undefined]
          };
        }

        const type = params.searchType
          ? Object.values(params.searchType).flat()
          : [];
        const tags = Object.values(params.searchTags).flat();

        const {
          fediverse = false,
          indexStepList = 10,
          indexStepMap = 0,
          defaultTypes,
          defaultTags,
          defaultFilters,
          defaultFields,
          defaultSortBy,
          notSourceKey,
        } = params.baseParams as Record<string, unknown>;

        const apiParam: Record<string, unknown> = {
          name: params.searchText,
          fediverse,
          indexMin: 0,
          indexStep: params.mapUsed ? indexStepMap : indexStepList,
        };

        if (tags.length > 0) {
          apiParam.searchTags = tags;
          apiParam.options = { tags: { verb: "$all" } };
        }

        if (defaultFilters) apiParam.filters = defaultFilters;
        if (defaultFields) apiParam.fields = defaultFields;
        if (defaultSortBy) apiParam.sortBy = defaultSortBy;
        if (notSourceKey) apiParam.notSourceKey = true;

        if (type.length > 0) {
          apiParam.searchType = type;
        } else if (defaultTypes) {
          apiParam.searchType = defaultTypes;
        }

        if (defaultTags && Array.isArray(defaultTags) && defaultTags.length > 0) {
          apiParam.searchTags = defaultTags;
        }

        if (!apiParam.searchType) {
          return {
            pages: [{
              results: [],
              count: {},
              hasNext: false,
              pageNumber: 1
            }],
            pageParams: [undefined]
          };
        }

        const result = await searchContext.searchCostum(apiParam);

        return {
          pages: [result],
          pageParams: [undefined]
        };
      },
    });
  } catch (error) {
    console.error("Erreur préchargement recherche:", error);
    return null;
  }
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

      // Détecter les sections searchPro ou searchProStatic
      const searchSections = p.sections.filter(
        (s: { type: string }) => s.type === 'searchPro' || s.type === 'searchProStatic'
      );

      // Pré-charger les résultats pour chaque section de recherche
      await Promise.all(
        searchSections.map(async (section: { type: string; props?: Record<string, unknown> }) => {
          const props = section.props || {};
          const baseParams = (props.baseParams as Record<string, unknown>) || {};
          const queryKeyPrefix = section.type === 'searchPro'
            ? 'searchCostum'
            : 'searchCostumStatic';

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

          return prefetchSearchResults(queryClient, {
            queryKeyPrefix,
            searchText: params.q,
            searchTags: params.tags,
            searchType: params.type,
            mapUsed: params.map,
            baseParams,
          });
        })
      );
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

