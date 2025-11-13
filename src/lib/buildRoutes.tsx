import type { RouteObject } from "react-router";
import { SiteRenderer } from '@/components/SiteRenderer';
import type { SiteConfig } from "@/types/site";
import RootLayout from "@/RootLayout";

import type { QueryClient } from "@tanstack/react-query";
import type { LoaderFunctionArgs } from "react-router";
import { getBaseUrl } from "./constant/common";
import { initApi } from "./apiClient";
import ProfilePage from "@/modules/profil/pages/ProfilePage";

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
          apiParam.defaultTags = defaultTags;
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
 * Construit l'arborescence de routes pour React Router v7 à partir
 * de la configuration JSON ‹pages›. Le layout racine (<RootLayout/>)
 * entoure toutes les pages et fournit les providers globaux.
 */
export function buildRoutes(cfg: SiteConfig, queryClient?: QueryClient): RouteObject[] {
  // enfants = chaque page décrite dans cfg.pages
  const children: RouteObject[] = cfg.pages.map((p) => ({
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
                  : {},
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
  children.push({
    path: ":slug",
    element: <ProfilePage />,
    loader: async ({ params }: LoaderFunctionArgs) => {
      // Si pas de queryClient (côté client), on skip le pre-fetch
      if (!queryClient) return null;

      // Nettoyer le slug (enlever le @ si présent)
      const rawSlug = params.slug;
      const slug = rawSlug?.startsWith('@') ? rawSlug.slice(1) : rawSlug;

      if (!slug) {
        throw new Response('Not Found', { status: 404 });
      }

      try {
        // Pré-charger les données du profil côté serveur
        return await queryClient.ensureQueryData({
          queryKey: ["element-about", slug],
          queryFn: async () => {
            const { organization } = await initApi({
              baseURL: getBaseUrl(),
              debug: true
            });
            if (!organization) {
              throw new Error("API non initialisée");
            }
            return organization.entityBySlug(slug);
          }
        });
      } catch (error) {
        console.error('Erreur lors du chargement du profil:', error);
        throw new Response('Not Found', { status: 404 });
      }
    }
  });

  // route 404 interne (dernier recours)
  children.push({ path: "*", element: <SiteRenderer /> });

  // route root qui encapsule tout avec RootLayout
  return [
    {
      path: "/",              // correspond à la racine du site
      element: <RootLayout config={cfg} />,  // ThemeProvider + Providers + <Outlet/>
      children,
    },
  ];
}

