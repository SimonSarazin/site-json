[← Retour à l'index](README.md)

# Architecture du projet

**Sommaire**

- [Architecture du projet](#architecture-du-projet)
  - [Arborescence des dossiers](#arborescence-des-dossiers)
  - [Flux d'exécution](#flux-dexécution)
    - [buildRoutes Synchrone vs Asynchrone](#buildroutes-synchrone-vs-asynchrone)
    - [Intégration des routes de modules](#intégration-des-routes-de-modules)
  - [Injection de la configuration et des ENV](#injection-de-la-configuration-et-des-env)
  - [Système de découverte de modules](#système-de-découverte-de-modules)
    - [Structure d'un module](#structure-dun-module)
    - [Configuration de module (`module.config.ts`)](#configuration-de-module-moduleconfigts)
    - [Auto-découverte avec `import.meta.glob`](#auto-découverte-avec-importmetaglob)
    - [Pattern factory de routes](#pattern-factory-de-routes)
    - [Chargement synchrone vs asynchrone](#chargement-synchrone-vs-asynchrone)
    - [Type discriminé `DiscoveredModule`](#type-discriminé-discoveredmodule)
    - [Guide : Créer un nouveau module](#guide--créer-un-nouveau-module)
  - [Voir aussi](#voir-aussi)

---

Cette section décrit l'organisation générale du code, le flux d'exécution et la façon dont la configuration et les variables d'environnement sont injectées, que ce soit côté client ou lors du rendu SSR.

---

## Arborescence des dossiers

```
.
├── scripts/               # Outils de génération automatique (ex. génération de config)
├── server/                # Serveurs Express (dev et prod)
│   ├── middleware/         # Middlewares Express
│   │   ├── imageOptimizer.js  # Optimisation d'images à la volée (sharp, cache disque)
│   │   └── imageUpload.js     # Upload d'images (multer)
│   ├── dev-server.js      # Serveur de dev avec middleware Vite (SSR + HMR)
│   └── prod-server.js     # Serveur de prod (compression, serveStatic, SSR streaming)
├── src/                   # Code source principal
│   ├── components/        # Composants React pour le UI
│   │   ├── layout/        # Header, Footer, SEO, Theme, etc.
│   │   ├── sections/      # Sections pilotées par JSON (hero, cards…)
│   │   └── ui/            # Composants UI partagés (buttons, inputs…)
│   ├── contexts/          # Providers React (SiteContext, Localization, Cocolight)
│   ├── data/              # Exemplaires de config (demo-site.ts)
│   ├── helpers/           # Fonctions utilitaires (ex. email validation)
│   ├── hooks/             # Hooks React (useToast, useInfiniteQueryScroll…)
│   ├── lib/               # Bibliothèques internes (apiClient, buildRoutes, sanitize, imageUtils)
│   ├── modules/           # Modules fonctionnels (search, profil, news, ampli, coform)
│   ├── types/             # Schémas Zod & types TS (site-schema, locale-schema…)
│   ├── entry-client.tsx   # Point d'entrée bundler client (hydrate React)
│   ├── entry-server.tsx   # Point d'entrée SSR (renderToPipeableStream)
│   └── RootLayout.tsx     # Layout global avec providers et React Router Outlet
├── .cache/                # Cache d'images optimisées (gitignored)
├── config.prod.json       # Configuration JSON structurée du site
├── package.json           # Dépendances, scripts, résolutions
├── tsconfig*.json         # Config TypeScript
└── vite.config.ts         # Configuration Vite (alias, plugins, SSR, define)
```

---

## Flux d'exécution

1. **Développement (`npm run dev` / `yarn dev`)**

   * **Vite** démarre en middleware (mode `middlewareMode: true`), servant le code client et gérant HMR.
   * **Express** dans `dev-server.js` reçoit toutes les requêtes et :

     * Sert les fichiers statiques via `vite.middlewares`.
     * Pour les autres requêtes (`/{*all}`), lit le template HTML, injecte la config JSON et lance le rendu SSR via `render` exposé par `entry-server.tsx`.

2. **Production (`npm run build` + `npm run preview` / `npm run start`)**

   * `npm run build` :

     * `build:client` compile et place le bundle client dans `dist/client`.
     * `build:server` compile le code SSR (`entry-server.tsx`) dans `dist/server`.
   * **Express** dans `prod-server.js` :

     * Sert `dist/client` (gzip via compression).
     * Pour SSR, lit encore le template HTML, injecte la config (via `SITE_CONFIG_JSON` ou `SITE_CONFIG_PATH`), puis appelle le rendu streamé du bundle serveur.

3. **Client**

   * À la réception du HTML, le `<script>window.__CONFIG__=…</script>` charge la config JSON.
   * Le `<script>window.__ENV__=…</script>` charge les ENV côté client.
   * React hydrate ensuite l'application via `entry-client.tsx`, utilisant les providers définis dans `RootLayout`.

---

### buildRoutes Synchrone vs Asynchrone

Le fichier `src/lib/buildRoutes.tsx` contient plusieurs utilitaires importants en plus de la fonction principale `buildRoutes`.

**`parseJSON` helper** : Parse les paramètres JSON depuis les query strings URL (utilisé pour les filtres de recherche) :

```typescript
function parseJSON(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
```

**`SECTION_EXTRACTORS` registry** : Registre extensible des extracteurs de sections imbriquées. Pour ajouter un nouveau type de container (comme `gridLayout` ou `tabs`), il suffit d'ajouter une ligne ici :

```typescript
const SECTION_EXTRACTORS: Record<string, (props: Record<string, unknown>) => unknown[]> = {
  gridLayout: (p) => [p.leftSection, p.rightSection],
  tabs: (p) => (Array.isArray(p.tabs) ? p.tabs : []).flatMap((t: { content: unknown }) => Array.isArray(t.content) ? t.content : []),
};
```

**`findSearchSections()` recursive function** : Recherche récursive des sections de recherche (`searchPro`/`searchProStatic`) dans l'arbre des sections, y compris dans les containers imbriqués (`gridLayout`, `tabs`). Utilise `SECTION_EXTRACTORS` pour parcourir les containers :

```typescript
function findSearchSections(
  sections: Array<{ type: string; props?: Record<string, unknown> }>
): Array<{ type: string; props?: Record<string, unknown> }> {
  const result: Array<{ type: string; props?: Record<string, unknown> }> = [];

  for (const section of sections) {
    if (section.type === 'searchPro' || section.type === 'searchProStatic') {
      result.push(section);
    }
    else if (SECTION_EXTRACTORS[section.type] && section.props) {
      const nested = SECTION_EXTRACTORS[section.type](section.props)
        .filter(Boolean) as Array<{ type: string; props?: Record<string, unknown> }>;
      result.push(...findSearchSections(nested));
    }
  }

  return result;
}
```

---

La fonction `buildRoutes` (dans `src/lib/buildRoutes.tsx`) retourne soit `RouteObject[]` (synchrone) soit `Promise<RouteObject[]>` (asynchrone) selon le contexte :

**Mode SYNCHRONE** (pas de queryClient + modules core uniquement) :
- Utilisé **côté client** après hydratation
- Appelle `getModuleRoutesSync(modules)` pour charger les routes immédiatement
- **Évite le flash de loading** lors de la navigation
- Les routes config JSON n'ont **pas de loaders** (pas de pré-chargement côté client)

```typescript
// src/lib/buildRoutes.tsx (lignes 71-107)
export function buildRoutes(cfg: SiteConfig, queryClient?: QueryClient): RouteObject[] | Promise<RouteObject[]> {
  const modules = discoverModules();
  const hasOptional = modules.some(m => m.config.type === "optional");

  // MODE SYNCHRONE : Côté client sans queryClient + modules core uniquement
  if (!queryClient && !hasOptional) {
    const configRoutes: RouteObject[] = cfg.pages.map((p) => ({
      path: p.path.replace(/^\/+/, ""),
      element: <SiteRenderer />,
      // Pas de loader côté client
    }));

    const moduleRoutes = getModuleRoutesSync(modules, undefined, cfg);  // ← Synchrone !

    const children: RouteObject[] = [
      ...configRoutes,
      ...moduleRoutes,
      { path: "*", element: <SiteRenderer /> },
    ];

    return [{
      path: "/",
      element: <RootLayout config={cfg} />,
      children,
    }];
  }

  // MODE ASYNCHRONE : Côté serveur avec queryClient ou modules optional
  return buildRoutesAsync(cfg, queryClient, modules);
}
```

**Mode ASYNCHRONE** (avec queryClient ou modules optional) :
- Utilisé **côté serveur** (SSR) pour pré-charger les données
- Appelle `buildRoutesAsync()` qui utilise `getModuleRoutes(modules, queryClient)`
- Les routes ont des **loaders** pour pré-charger les données (ex: SearchPro, profils)
- Support **code-splitting** des modules optional

```typescript
// src/lib/buildRoutes.tsx (lignes 113-192)
async function buildRoutesAsync(
  cfg: SiteConfig,
  queryClient: QueryClient | undefined,
  modules: ReturnType<typeof discoverModules>
): Promise<RouteObject[]> {
  // Routes config avec loaders pour SearchPro
  const configRoutes = cfg.pages.map((p) => ({
    path: p.path.replace(/^\/+/, ""),
    element: <SiteRenderer />,
    loader: async ({ request }: LoaderFunctionArgs) => {
      if (!queryClient) return null;

      const url = new URL(request.url);
      const searchParams = {
        q: url.searchParams.get('q') || '',
        tags: (parseJSON(url.searchParams.get('tags')) as Record<string, string[]>) || {},
        type: (parseJSON(url.searchParams.get('type')) as Record<string, string[]>) || {},
        map: url.searchParams.get('map') !== 'false',
      };

      // Détecter les sections searchPro/searchProStatic
      // (y compris dans gridLayout, tabs, etc. via findSearchSections)
      const searchSections = findSearchSections(p.sections);

      // Pré-charger les résultats pour chaque section
      await Promise.all(
        searchSections.map(async (section) => {
          const props = section.props || {};
          const baseParams = (props.baseParams as Record<string, unknown>) || {};
          const queryKeyPrefix = section.type === 'searchPro'
            ? 'searchCostum'
            : 'searchCostumStatic';

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
    }
  }));

  const moduleRoutes = await getModuleRoutes(modules, queryClient, cfg);  // ← Asynchrone !

  return [{
    path: "/",
    element: <RootLayout config={cfg} />,
    children: [...configRoutes, ...moduleRoutes, { path: "*", element: <SiteRenderer /> }],
  }];
}
```

**Avantages** :
- **Côté client** : pas de flash loading, navigation instantanée pour modules core
- **Côté serveur** : données pré-chargées, SEO optimal, HTML initial complet

---

### Intégration des routes de modules

Les routes finales combinent trois sources :

1. **Routes config JSON** : Pages définies dans `config.prod.json`
2. **Routes des modules** : Découvertes automatiquement via `discoverModules()` (voir [Système de découverte de modules](#système-de-découverte-de-modules))
3. **Route 404** : Catch-all `{ path: "*" }` pour les erreurs

```typescript
const children: RouteObject[] = [
  ...configRoutes,      // Pages JSON (/, /about, etc.)
  ...moduleRoutes,      // Modules découverts (/:slug pour profil, etc.)
  { path: "*", element: <SiteRenderer /> }  // 404
];
```

**Ordre d'importance** : Les routes sont évaluées dans l'ordre. Les routes de modules viennent **après** les routes config, donc une page config `/about` aura priorité sur une route module `/about`.

---

## Injection de la configuration et des ENV

* **Configuration JSON**
  Le serveur SSR injecte la config du site sous forme d'un script inline :

  ```html
  <script>
    window.__CONFIG__ = { /* contenu de SITE_CONFIG_JSON ou du fichier SITE_CONFIG_PATH */ };
  </script>
  ```

* **Variables d'environnement**
  Si `VITE_BASE_URL_BACKEND`, `VITE_SERVER_URL` ou `VITE_SLUG` sont définies, elles sont injectées de la même manière :

  ```html
  <script>
    window.__ENV__ = {
      VITE_BASE_URL_BACKEND: "...",
      VITE_SERVER_URL: "...",
      VITE_SLUG: "..."
    };
  </script>
  ```

* **Lecture unifiée**
  Côté client et SSR, la fonction `readEnv` cherche d'abord `window.__ENV__`, puis `process.env`, puis `import.meta.env`, assurant une cohérence entre développement et production.

---

## Système de découverte de modules

SiteForge 2.0 introduit un **système de découverte automatique de modules** qui élimine le besoin d'enregistrer manuellement les routes. Les modules sont découverts via `import.meta.glob` de Vite, compatible SSR.

---

### Structure d'un module

Chaque module vit dans `src/modules/<moduleName>/` et peut inclure :

```
src/modules/profil/
├── module.config.ts    # Configuration du module (optionnel)
├── routes.tsx          # Factory de routes (optionnel)
├── components/         # Composants du module
├── hooks/              # Hooks personnalisés
├── contexts/           # Contextes React
├── schema.ts           # Schémas Zod de validation
├── i18n/               # Fichiers de traduction
│   ├── fr.json
│   └── en.json
└── index.ts            # Exports centralisés
```

**Convention** :
- Si le module a des routes, il doit exporter un fichier `routes.tsx`
- Si le module a une config spécifique, il peut avoir `module.config.ts`
- Si ni l'un ni l'autre n'existe, le module est juste une bibliothèque de composants

---

### Configuration de module (`module.config.ts`)

```typescript
// src/modules/profil/module.config.ts
import type { ModuleConfigSchema } from "@/lib/modules";

const config: ModuleConfigSchema = {
  name: "profil",          // Nom unique du module
  type: "core",            // "core" ou "optional"
  enabled: true            // false pour désactiver
};

export default config;
```

**Types de modules** :

| Type | Comportement | Usage |
|------|-------------|-------|
| `core` | Chargé en **eager** (synchrone) | Modules essentiels toujours nécessaires (profil, auth) |
| `optional` | Chargé en **lazy** (asynchrone) | Modules accessoires, code-splittés (analytics, admin) |

**Modules sans config** : Si `module.config.ts` n'existe pas, le module est traité comme `type: "core"` par défaut.

---

### Auto-découverte avec `import.meta.glob`

La fonction `discoverModules()` dans `src/lib/modules.ts` utilise trois appels à `import.meta.glob` :

```typescript
// src/lib/modules.ts (lignes 42-58)
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
    { eager: false }  // ← Pas de chargement immédiat
  );

  // ... logique de fusion
}
```

**Vite compile** ces appels au build time en imports statiques, garantissant la compatibilité SSR.

---

### Pattern factory de routes

Les modules exportent une fonction factory `routes` qui reçoit un `QueryClient` optionnel pour SSR et la `SiteConfig` :

```typescript
// src/lib/modules.ts
export interface ModuleRouteFactory {
  (queryClient?: QueryClient, config?: SiteConfig): RouteObject[];
}
```

```typescript
// src/modules/profil/routes.tsx
import type { ModuleRouteFactory } from "@/lib/modules";
import type { QueryClient } from "@tanstack/react-query";
import type { SiteConfig } from "@/types/site-schema";
import type { RouteObject } from "react-router";

export const routes: ModuleRouteFactory = (queryClient?: QueryClient, config?: SiteConfig): RouteObject[] => [
  {
    path: ":slug",                    // Route dynamique
    element: <ProfilePage />,
    loader: async ({ params }) => {
      // SSR pre-fetching si queryClient fourni
      if (!queryClient) return null;

      const slug = params.slug?.startsWith('@') ? params.slug.slice(1) : params.slug;

      return await queryClient.ensureQueryData({
        queryKey: ["element-about", slug],
        queryFn: async () => {
          const { organization } = await initApi({ baseURL: getBaseUrl() });
          return organization.entityBySlug(slug);
        }
      });
    }
  }
];
```

**Avantages** :
- **Type-safe** : TypeScript valide les types de routes
- **SSR-friendly** : Le `queryClient` permet le pré-chargement des données
- **Flexible** : Chaque module contrôle ses propres routes

---

### Chargement synchrone vs asynchrone

Deux fonctions récupèrent les routes des modules découverts :

**`getModuleRoutesSync(modules, queryClient?, config?)`** - Synchrone, client-side :

```typescript
// src/lib/modules.ts
export function getModuleRoutesSync(
  modules: DiscoveredModule[],
  queryClient?: QueryClient,
  config?: SiteConfig
): RouteObject[] {
  return modules.flatMap(module => {
    if (module.config.type === "core") {
      const coreModule = module as Extract<DiscoveredModule, { config: { type: "core" } }>;
      return coreModule.routes(queryClient, config);
    }
    throw new Error(`getModuleRoutesSync ne supporte que les modules core. Module "${module.config.name}" est de type "${module.config.type}"`);
  });
}
```

- Utilisée **côté client** quand il n'y a que des modules core
- **Pas de loading flash** : tout est disponible immédiatement
- Lance une erreur si un module optional est détecté

**`getModuleRoutes(modules, queryClient?, config?)`** - Asynchrone, server-side :

```typescript
// src/lib/modules.ts
export async function getModuleRoutes(
  modules: DiscoveredModule[],
  queryClient?: QueryClient,
  config?: SiteConfig
): Promise<RouteObject[]> {
  const routePromises = modules.map(async (module): Promise<RouteObject[]> => {
    if (module.config.type === "core") {
      const coreModule = module as Extract<DiscoveredModule, { config: { type: "core" } }>;
      return coreModule.routes(queryClient, config);
    } else {
      // Module optional : routes chargées à la demande
      const optModule = module as Extract<DiscoveredModule, { config: { type: "optional" } }>;
      const loaded = await optModule.routes();
      return loaded.routes(queryClient, config);
    }
  });

  const routeArrays = await Promise.all(routePromises);
  return routeArrays.flat();
}
```

- Utilisée **côté serveur** (SSR) ou quand des modules optional existent
- Support **code-splitting** : modules optional chargés à la demande
- Pré-charge les données via les loaders

---

### Type discriminé `DiscoveredModule`

Le système utilise un union type discriminé pour la type-safety :

```typescript
// src/lib/modules.ts (lignes 25-33)
export type DiscoveredModule =
  | {
      config: ModuleConfigSchema & { type: "core" };
      routes: ModuleRouteFactory;  // ← Fonction directe
    }
  | {
      config: ModuleConfigSchema & { type: "optional" };
      routes: () => Promise<{ routes: ModuleRouteFactory }>;  // ← Loader async
    };
```

TypeScript garantit que :
- Les modules **core** ont des routes synchrones
- Les modules **optional** ont des routes asynchrones (lazy-loaded)

---

### Guide : Créer un nouveau module

**Etape 1 : Créer la structure**

```bash
mkdir -p src/modules/mymodule/{components,hooks,contexts,i18n}
touch src/modules/mymodule/{module.config.ts,routes.tsx,schema.ts,index.ts}
touch src/modules/mymodule/i18n/{fr,en}.json
```

**Etape 2 : Définir la configuration** (optionnel)

```typescript
// src/modules/mymodule/module.config.ts
import type { ModuleConfigSchema } from "@/lib/modules";

const config: ModuleConfigSchema = {
  name: "mymodule",
  type: "core",      // ou "optional" pour code-splitting
  enabled: true
};

export default config;
```

**Etape 3 : Exporter les routes** (si le module a des routes)

```typescript
// src/modules/mymodule/routes.tsx
import type { ModuleRouteFactory } from "@/lib/modules";
import { MyPage } from "./components/MyPage";

export const routes: ModuleRouteFactory = (queryClient) => [
  {
    path: "mypath",
    element: <MyPage />,
    loader: async () => {
      // Pré-chargement SSR optionnel
      if (!queryClient) return null;
      return await queryClient.ensureQueryData({
        queryKey: ["mydata"],
        queryFn: fetchMyData
      });
    }
  }
];
```

**Etape 4 : Le module est automatiquement découvert !**

Au prochain démarrage, `discoverModules()` trouve et charge le module sans configuration supplémentaire.

**Etape 5 : Exporter les API publiques** (optionnel)

```typescript
// src/modules/mymodule/index.ts
export { routes } from "./routes";
export { MyPage } from "./components/MyPage";
export { useMyHook } from "./hooks/useMyHook";
```

---

## Voir aussi

- [Configuration](02-configuration.md)
- [Schéma principal](04-schema-principal.md)
- [Sections dynamiques](06-sections-dynamiques.md)
