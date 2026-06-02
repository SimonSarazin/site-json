import type { RouteObject } from "react-router";
import type { QueryClient } from "@tanstack/react-query";
import type { SiteConfig } from "@/types/site-schema";
import type { ComponentType, ReactNode } from "react";

/**
 * Factory function pour créer des routes de module
 * Reçoit le QueryClient optionnel pour le SSR et la config du site
 */
export interface ModuleRouteFactory {
  (queryClient?: QueryClient, config?: SiteConfig): RouteObject[];
}

/**
 * Provider page-scoped exposé par un module — composé automatiquement par
 * `SiteRenderer` autour de chaque page (ordre = ordre de découverte des
 * modules). Pattern documenté dans `src/lib/pageState/`.
 *
 * Utilisé quand plusieurs sections d'une même page doivent partager du state
 * sans coupler le générique (`SiteRenderer`) au module spécifique.
 */
export type ModulePageProvider = ComponentType<{ children: ReactNode }>;

/**
 * Configuration d'un module
 */
export interface ModuleConfigSchema {
  name: string;
  type: "core" | "optional";
  enabled?: boolean;
  /**
   * Provider React monté autour de chaque page par `SiteRenderer`. Optionnel —
   * la plupart des modules n'en ont pas besoin (state local section-scoped
   * dans leur Provider interne).
   */
  PageProvider?: ModulePageProvider;
}

/**
 * Module découvert avec config et routes.
 * Union type discriminé par config.type. `routes` est `null` si le module
 * n'a pas de `routes.tsx` (ex: module qui n'expose qu'un `PageProvider`).
 */
export type DiscoveredModule =
  | {
    config: ModuleConfigSchema & { type: "core" };
    routes: ModuleRouteFactory | null;
  }
  | {
    config: ModuleConfigSchema & { type: "optional" };
    routes: (() => Promise<{ routes: ModuleRouteFactory }>) | null;
  };

/**
 * Découvre tous les modules avec import.meta.glob
 *
 * Convention :
 * - module.config.ts (optionnel) : définit type (core/optional) et enabled
 * - routes.tsx (optionnel) : exporte routes: ModuleRouteFactory
 *
 * Modules CORE : chargés en eager (synchrone, pas de flash loading)
 * Modules OPTIONAL : chargés en lazy (code splitting)
 *
 * @returns Liste des modules découverts
 */
export function discoverModules(): DiscoveredModule[] {
  // 1. Charger toutes les configs (eager)
  const configs = import.meta.glob<{ default: ModuleConfigSchema }>(
    "/src/modules/*/module.config.ts",
    { eager: true }
  );

  // 2. Charger les routes CORE en eager (sync)
  const coreRoutes = import.meta.glob<{ routes: ModuleRouteFactory }>(
    "/src/modules/*/routes.tsx",
    { eager: true }
  );

  // 3. Charger les routes OPTIONAL en lazy (async)
  const optionalRoutes = import.meta.glob<{ routes: ModuleRouteFactory }>(
    "/src/modules/*/routes.tsx",
    { eager: false }
  );

  const modules: DiscoveredModule[] = [];

  // Pour chaque config trouvée
  for (const [configPath, configModule] of Object.entries(configs)) {
    const config = configModule.default;

    // Skip si désactivé
    if (config.enabled === false) continue;

    const modulePath = configPath.replace("/module.config.ts", "/routes.tsx");

    if (config.type === "core") {
      // Module core : routes chargées en eager (ou null si pas de routes.tsx)
      const routeModule = coreRoutes[modulePath];
      modules.push({
        config: { ...config, type: "core" as const },
        routes: routeModule?.routes ?? null,
      });
    } else {
      // Module optional : routes en lazy (ou null si pas de routes.tsx)
      const routeLoader = optionalRoutes[modulePath];
      modules.push({
        config: { ...config, type: "optional" as const },
        routes: routeLoader
          ? async () => {
              const module = await routeLoader();
              return { routes: module.routes };
            }
          : null,
      });
    }
  }

  // Aussi chercher les routes sans config (défaut: core)
  for (const [routePath, routeModule] of Object.entries(coreRoutes)) {
    const configPath = routePath.replace("/routes.tsx", "/module.config.ts");

    // Si pas de config, on l'ajoute comme module core par défaut
    if (!configs[configPath]) {
      const moduleName = routePath.match(/\/modules\/([^/]+)\//)?.[1] || "unknown";

      if (routeModule?.routes) {
        modules.push({
          config: {
            name: moduleName,
            type: "core" as const
          },
          routes: routeModule.routes
        });
      }
    }
  }

  return modules;
}

/**
 * Récupère les routes des modules CORE uniquement (synchrone)
 *
 * Cette fonction est utilisée côté client quand il n'y a que des modules core
 * pour éviter le flash de loading.
 *
 * @param modules - Modules découverts (doivent tous être core)
 * @param queryClient - Client React Query pour SSR
 * @param config - Configuration du site (optionnelle)
 * @returns Routes combinées de tous les modules core
 * @throws Error si un module optional est trouvé
 */
export function getModuleRoutesSync(
  modules: DiscoveredModule[],
  queryClient?: QueryClient,
  config?: SiteConfig
): RouteObject[] {
  return modules.flatMap(module => {
    if (module.config.type === "core") {
      const coreModule = module as Extract<DiscoveredModule, { config: { type: "core" } }>;
      // Skip si le module n'a pas de routes.tsx (ex: module exposant juste un PageProvider).
      if (!coreModule.routes) return [];
      return coreModule.routes(queryClient, config);
    }
    throw new Error(`getModuleRoutesSync ne supporte que les modules core. Module "${module.config.name}" est de type "${module.config.type}"`);
  });
}

/**
 * Récupère les routes de tous les modules découverts (asynchrone)
 *
 * Cette fonction supporte à la fois les modules core et optional.
 * Utilisée côté serveur (SSR) ou quand il y a des modules optional.
 *
 * @param modules - Modules découverts
 * @param queryClient - Client React Query pour SSR
 * @param config - Configuration du site (optionnelle)
 * @returns Routes combinées de tous les modules
 */
export async function getModuleRoutes(
  modules: DiscoveredModule[],
  queryClient?: QueryClient,
  config?: SiteConfig
): Promise<RouteObject[]> {
  const routePromises = modules.map(async (module): Promise<RouteObject[]> => {
    if (module.config.type === "core") {
      const coreModule = module as Extract<DiscoveredModule, { config: { type: "core" } }>;
      if (!coreModule.routes) return [];
      return coreModule.routes(queryClient, config);
    } else {
      const optModule = module as Extract<DiscoveredModule, { config: { type: "optional" } }>;
      if (!optModule.routes) return [];
      const loaded = await optModule.routes();
      return loaded.routes(queryClient, config);
    }
  });

  const routeArrays = await Promise.all(routePromises);
  return routeArrays.flat();
}

/**
 * Collecte les Providers page-scoped déclarés par les modules dans leur
 * `module.config.ts` (champ `PageProvider`). À composer autour de chaque
 * page dans `SiteRenderer`.
 *
 * Ordre = ordre de découverte des modules (généralement alphabétique selon
 * import.meta.glob). Si un module B dépend du context d'un module A, il
 * faudrait introduire un système de priorité — pas implémenté car aucun cas
 * d'usage à ce jour.
 *
 * @param modules - Modules découverts via `discoverModules()`
 * @returns Liste de composants Provider (peut être vide)
 */
export function getPageProviders(modules: DiscoveredModule[]): ModulePageProvider[] {
  return modules
    .map((m) => m.config.PageProvider)
    .filter((p): p is ModulePageProvider => p !== undefined);
}
