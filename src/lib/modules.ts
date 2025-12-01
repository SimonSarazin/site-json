import type { RouteObject } from "react-router";
import type { QueryClient } from "@tanstack/react-query";

/**
 * Factory function pour créer des routes de module
 * Reçoit le QueryClient optionnel pour le SSR
 */
export interface ModuleRouteFactory {
  (queryClient?: QueryClient): RouteObject[];
}

/**
 * Configuration d'un module
 */
export interface ModuleConfigSchema {
  name: string;
  type: "core" | "optional";
  enabled?: boolean;
}

/**
 * Module découvert avec config et routes
 * Union type discriminé par config.type
 */
export type DiscoveredModule =
  | {
    config: ModuleConfigSchema & { type: "core" };
    routes: ModuleRouteFactory;
  }
  | {
    config: ModuleConfigSchema & { type: "optional" };
    routes: () => Promise<{ routes: ModuleRouteFactory }>;
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
      // Module core : routes chargées en eager
      const routeModule = coreRoutes[modulePath];
      if (routeModule?.routes) {
        modules.push({
          config: { ...config, type: "core" as const },
          routes: routeModule.routes
        });
      }
    } else {
      // Module optional : routes en lazy
      const routeLoader = optionalRoutes[modulePath];
      if (routeLoader) {
        modules.push({
          config: { ...config, type: "optional" as const },
          routes: async () => {
            const module = await routeLoader();
            return { routes: module.routes };
          }
        });
      }
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
 * @returns Routes combinées de tous les modules core
 * @throws Error si un module optional est trouvé
 */
export function getModuleRoutesSync(
  modules: DiscoveredModule[],
  queryClient?: QueryClient
): RouteObject[] {
  return modules.flatMap(module => {
    if (module.config.type === "core") {
      const coreModule = module as Extract<DiscoveredModule, { config: { type: "core" } }>;
      return coreModule.routes(queryClient);
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
 * @returns Routes combinées de tous les modules
 */
export async function getModuleRoutes(
  modules: DiscoveredModule[],
  queryClient?: QueryClient
): Promise<RouteObject[]> {
  const routePromises = modules.map(async (module): Promise<RouteObject[]> => {
    if (module.config.type === "core") {
      // Core module (sync) - routes est directement un ModuleRouteFactory
      const coreModule = module as Extract<DiscoveredModule, { config: { type: "core" } }>;
      return coreModule.routes(queryClient);
    } else {
      // Optional module (async) - routes est un loader
      const optModule = module as Extract<DiscoveredModule, { config: { type: "optional" } }>;
      const loaded = await optModule.routes();
      return loaded.routes(queryClient);
    }
  });

  const routeArrays = await Promise.all(routePromises);
  return routeArrays.flat();
}
