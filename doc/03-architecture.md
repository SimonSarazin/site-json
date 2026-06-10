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
  - [Page-scoped state factory](#page-scoped-state-factory)
  - [Système de visibilité (`VisibilityCondition`)](#système-de-visibilité-visibilitycondition)
  - [Hooks utilitaires (référence)](#hooks-utilitaires-référence)
  - [Pipeline de rendu (référence)](#pipeline-de-rendu-référence)
    - [`entry-server.tsx` — rendu SSR](#entry-servertsx--rendu-ssr)
    - [`entry-client.tsx` — hydratation client](#entry-clienttsx--hydratation-client)
    - [`RootLayout.tsx` — layout racine](#rootlayouttsx--layout-racine)
    - [Contextes React](#contextes-react-srccontexts)
    - [`SiteRenderer.tsx` — rendu de page](#siterenderertsx--rendu-de-page)
    - [`SiteHeader.tsx` / `SiteFooter.tsx`](#siteheadertsx--sitefootertsx--variantes-de-headerfooter)
    - [`SectionRenderer.tsx` — rendu de section](#sectionrenderertsx--rendu-de-section)
    - [`src/lib/apiClient.ts`](#srclibapiclientts--client-api-cocolight)
    - [Composants layout auxiliaires](#composants-layout-auxiliaires)
  - [Utilitaires `src/lib/` (référence)](#utilitaires-srclib-référence)
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
│   ├── modules/           # Modules fonctionnels (search, profil, news, ampli, coform, auth, cagnotte, interop)
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

**`findSearchSections()` recursive function** : Recherche récursive des sections de recherche (`searchPro`/`searchProStatic`) dans l'arbre des sections, y compris dans les containers imbriqués (`gridLayout`, `tabs`). Utilise `SECTION_EXTRACTORS` pour parcourir les containers.

**`findFiltersSections()` (module search, `src/modules/search/prefetch/prefetchFilters.ts`)** : Homologue générique pour le prefetch SSR des filtres. Au lieu de matcher un `type` en dur, il détecte toute section qui **déclare** des props de filtres (`filterGroups`, `filtersByAnswers`, `filtersByPath`) — ce qui couvre la `FiltersSection` classique ET le `hero-tiers-lieux` (applicateur headless de la home) sans cas particulier.

```typescript
// src/modules/search/prefetch/prefetchFilters.ts
export function findFiltersSections(sections: RawSection[]): RawSection[] {
  const result: RawSection[] = [];
  for (const section of sections) {
    const props = (section.props ?? {}) as Record<string, unknown>;
    // Générique : toute section déclarant des filtres est pré-chargée
    if (props.filterGroups || props.filtersByAnswers || props.filtersByPath) {
      result.push(section);
    }
    if (SECTION_EXTRACTORS[section.type] && section.props) {
      const nested = SECTION_EXTRACTORS[section.type](section.props)
        .filter(Boolean) as RawSection[];
      result.push(...findFiltersSections(nested));
    }
  }
  return result;
}
```

Cette approche garantit que l'ajout de tout nouveau composant déclarant `filterGroups` est automatiquement pré-chargé côté SSR sans modifier la fonction.

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

## Page-scoped state factory

Quand plusieurs sections d'une même page partagent un état (ex: filtres de recherche lisibles par une section carte ET une section compteur), React Query n'est pas adapté (c'est du state UI, pas du cache serveur) et un contexte global serait trop large.

La factory `createPageActionsState` dans `src/lib/pageState/createPageActionsState.tsx` crée des contextes React page-scoped réutilisables. Elle suit le pattern `{ state, actions, derived }`.

### API de la factory

```ts
import { createPageActionsState } from "@/lib/pageState/createPageActionsState";

export const PageFilters = createPageActionsState({
  name: "PageFilters",
  initialState: { selectedFilters: {}, searchQuery: "" },
  actions: ({ set, reset, get }) => ({
    setSearchQuery: (v: string) => set(s => ({ ...s, searchQuery: v })),
    setFilter: (key: string, values: string[]) =>
      set(s => ({ ...s, selectedFilters: { ...s.selectedFilters, [key]: values } })),
    clearFilters: () => reset(),
    // get() lit l'état courant sans closure stale
    getCurrentQuery: () => get().searchQuery,
  }),
  derived: (s) => ({
    filterNames: Object.values(s.selectedFilters).flat(),
  }),
});
```

Le retour expose :
- `PageFilters.Provider` — composant à monter autour de l'arbre consommateur
- `PageFilters.use()` — hook strict (throw si hors Provider)
- `PageFilters.useOptional()` — hook optionnel (retourne `null` si hors Provider)
- `PageFilters.Context` — contexte React brut (tests ou Provider custom)

**Caractéristiques clés :**
- `actions` est mémoïsé **une seule fois** — référence stable entre renders
- `state` est mémoïsé par `rawState` — les sections qui ne lisent que `actions` ne re-rendent pas
- `helpers.get()` lit toujours l'état courant via une ref (évite les closures stale dans les actions composées)
- `helpers.reset()` remet à `initialState` (valeur ou factory)

### Intégration dans les modules (`module.config.PageProvider`)

Les modules peuvent exposer un `PageProvider` dans leur `module.config.ts`. `SiteRenderer` le monte automatiquement autour de chaque page :

```ts
// src/modules/search/module.config.ts
import { PageFilters } from "./contexts/pageFilters";

const config: ModuleConfigSchema = {
  name: "search",
  type: "core",
  PageProvider: PageFilters.Provider,  // ← monté par SiteRenderer
};
export default config;
```

Cette approche découple `SiteRenderer` des modules spécifiques : il compose les `PageProvider` de tous les modules sans les connaître directement.

**Premier consommateur :** `src/modules/search/contexts/pageFilters.ts` (migration de l'ancien `PageFiltersContext` vers ce pattern).

---

## Système de visibilité (`VisibilityCondition`)

Le système de visibilité (`src/lib/visibility/`) évalue une condition déclarative pour masquer/afficher des éléments UI en fonction de l'état courant (auth, route, permissions).

### Schéma

```ts
// src/lib/visibility/schema.ts
const VisibilityConditionSchema = z.object({
  auth: z.enum(["required", "anonymous", "any"]).optional(),
  routes: z.array(z.string()).optional(),
  excludeRoutes: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
}).optional();
```

| Champ | Sémantique |
|---|---|
| `auth: "required"` | Visible uniquement si connecté |
| `auth: "anonymous"` | Visible uniquement si NON connecté |
| `auth: "any"` ou absent | Visible pour tous |
| `routes: ["/profil/*"]` | Visible uniquement sur ces routes (whitelist, supporte wildcards `*`) |
| `excludeRoutes: ["/admin"]` | Caché sur ces routes (blacklist, prioritaire sur `routes`) |
| `permissions: ["canAddOrganization"]` | Toutes ces permissions doivent être `true` |

Les conditions sont ANDées : un `VisibilityCondition` vide (ou absent) = visible pour tous.

### Hooks

```ts
import { useVisibility, useVisibilityList } from "@/lib/visibility";

// Un seul élément
const visible = useVisibility({ auth: "required", routes: ["/profil/*"] });

// Plusieurs conditions en une passe (évite d'appeler useVisibility dans un .map())
const visibilities = useVisibilityList([
  { auth: "required" },
  { auth: "anonymous" },
  undefined,  // toujours visible
]);
```

**SSR — comportement stable :** avant hydration, si la condition dépend de `auth` ou `permissions`, l'élément est masqué (évite un flash de contenu privé). Si seules `routes`/`excludeRoutes` sont utilisées, le pathname est stable SSR/client donc l'évaluation est normale.

### Usages actuels

- `FloatingActionButton` — items custom avec `condition` en config JSON
- Tabs de profil — `condition.auth` par onglet (`required`/`anonymous`/`any`)
- `AddEntityDropdown` — affichage conditionnel selon auth

---

## Hooks utilitaires (référence)

Hooks clés disponibles dans `src/hooks/` — référence rapide pour les développeurs de modules.

### Accès aux contextes globaux

| Hook | Fichier | Retour | Usage |
|---|---|---|---|
| `useCocolight()` | `useCocolight.tsx` | `{ entity, me, refreshMe, loading, api, helper }` | Accès à l'entité Cocolight courante et à l'utilisateur connecté |
| `useSite()` | `useSite.tsx` | `{ config, setConfig }` | Accès à la config JSON du site |
| `useLocalization()` | `useLocalization.tsx` | `{ locale, setLocale, locales }` | Locale courante et changement de langue |
| `useT(ns?)` | `useT.ts` | `(key, fallback?, params?) => string` | Traduction i18n (locale-aware pour `LocalizedString`) |

### Pagination infinie

Trois variantes selon le besoin :

| Hook | Usage | Retour clé |
|---|---|---|
| `useInfiniteQueryScroll` | Pagination générique React Query | `lastItemRef`, `fetchNextPage`, `hasNextPage` |
| `useInfiniteQueryScrollNext` | Pagination avec `PaginatorPage<T>` SDK | Idem + `getNextPageParam` automatique |
| `useInfiniteQueryScrollNextWithTransform` | Idem + transformation SSR des Proxy reactifs | Idem + `totalCount`, `hasCount` |

`lastItemRef` est un `RefCallback<HTMLElement>` à attacher au dernier élément de la liste. Il utilise `IntersectionObserver` pour déclencher automatiquement `fetchNextPage` quand l'élément devient visible.

`useInfiniteQueryScrollNextWithTransform` résout le problème SSR : les entités hydratées depuis `window.__REACT_QUERY_STATE__` sont des plain objects (pas des Proxy SDK). Ce hook détecte la situation et appelle `restorePaginationFromJSON` + `transformToEntityInstance` après hydratation.

### Onglets lazy

```ts
const { isActive, hasBeenActive, shouldLoad } = useLazyTab("news");
// shouldLoad = true si l'onglet est actif OU a déjà été visité
// → passer shouldLoad comme `enabled` dans useQuery pour éviter les fetches inutiles
```

`useLazyTab` détecte l'onglet actif depuis l'URL : `/profil/slug/news` → `"news"`, `/profil/slug` → `"about"`.

### Hydratation SSR

```ts
// Retourne null côté SSR / premier render (pour éviter les mismatches d'hydratation)
// Retourne entity.userContext.id après mount
const userContextId = useHydratedUserContextId();
```

Ce hook est utilisé dans les `queryKey` des modules news et cagnotte pour forcer un refetch du cache lors du login/logout sans causer d'erreur d'hydratation.

### Modules client-only

```ts
const [mounted, MapModule] = useClientModule(() => import("./SearchMap"));
if (!mounted || !MapModule) return <Skeleton />;
const SearchMap = MapModule.default;
return <SearchMap {...props} />;
```

`useClientModule` retourne `[false, null]` côté serveur et après la première hydratation. Utile pour les composants incompatibles SSR (Leaflet, recharts avec window, etc.).

### Guards de page

```ts
usePageGuards(page); // dans le composant de page
```

Évalue les règles `page.auth` et `page.middleware` et redirige si besoin :
- `page.auth.required: true` → redirige vers `/login` si non connecté
- `page.auth.roles: ["admin"]` → vérifie `me.serverData.roles`
- `page.middleware: ["redirect-if-authenticated"]` → redirige vers `/` si déjà connecté

### Permissions

```ts
// Hook centralisé multi-namespace
import { usePermissions } from "@/lib/permissions";
const { profil, news } = usePermissions<{ profil: ProfilPermissions; news: NewsPermissions }>(
  ["profil", "news"],
  entity,
  { news: newsItem }
);

// Hook rétrocompatible (agrège profil + news)
const { canEditProfile, canAddNews } = useUserPermissions(entity, news?);
```

### Autocomplete

`useAutocomplete` vit dans `src/modules/search/hooks/useAutocomplete.ts` (module search, pas dans `src/hooks/`). Il est partagé par les sections de recherche ET par le hero `hero-tiers-lieux` qui l'utilise pour l'autocompletion scopee réseau.

```ts
// src/modules/search/hooks/useAutocomplete.ts
// query est le 1er argument positionnel (string contrôlé par le composant parent)
const { suggestions, isLoading, error } = useAutocomplete(search, {
  baseParams,      // scope réseau (même format que searchProStatic)
  variant,         // "default" | "navigator-tl"
  tags,            // tags de filtres actifs
  minChars: 2,     // (défaut 2)
  debounceMs: 300, // (défaut 300)
});
```

Il construit son payload via `buildSearchPayload` (meme logique que `useSearchQuery`) pour garantir la coherence entre autocompletion et liste.

### Debounce

```ts
const debouncedValue = useDebounce(value, 300); // ms
```

### Mutations avec toasts

```ts
// Utilisé en interne par toutes les factories de mutation (createEntityMutation, createInteropMutation, etc.)
const mutation = useMutationWithToast<TData, TParams>({
  mutationFn: async (params) => { /* ... */ return data; },
  namespace: "modules/mymodule",
  successKey: "toast.success",
  errorKey: "toast.error",
  invalidateQueries: [["mykey"]],
  onSuccessCallback: () => { /* ... */ },
});
```

---

## Pipeline de rendu (référence)

Cette section détaille les composants et fichiers clés du pipeline de rendu, du point d'entrée serveur jusqu'à l'affichage des sections.

---

### `entry-server.tsx` — rendu SSR

Exporte une seule fonction `render(req, res, cfg, onHead, closingTags)`. Appelée par `dev-server.js` et `prod-server.js` pour chaque requête HTTP.

**Étapes d'exécution :**

1. `resetApiState()` — reset du singleton API pour éviter la contamination entre requêtes parallèles
2. Création du `QueryClient` (staleTime 60s, refetchOnWindowFocus false)
3. `buildRoutes(cfg, queryClient)` — construit l'arbre de routes React Router avec loaders SSR
4. `handler.query(new Request(absUrl))` — exécute les loaders pour la requête courante
5. Redirection : si le loader retourne une `Response`, la requête HTTP est redirigée immédiatement
6. `queryClient.ensureQueryData({ queryKey: ["cocolight-init"] })` — init de l'API Cocolight avant le rendu
7. Stockage des données sérialisables dans `cocolight-data` (exclut les instances de classe non-sérialisables)
8. `dehydrate(queryClient)` — exporte l'état React Query (sans `cocolight-init`)
9. `preloadAll()` — précharge tous les lazy chunks (vite-preload) pour le rendu SSR
10. `createChunkCollector()` — prépare la collecte des modulepreloads
11. `renderToPipeableStream(...)` — démarre le rendu React 19 en streaming

**Arbre JSX rendu côté serveur :**

```
HelmetProvider
  ChunkCollectorContext           (collecte les chunks lazy utilisés)
    QueryClientProvider
      HydrationBoundary           (state = dehydratedState)
        StaticRouterProvider      (router = routes JSON + module routes)
```

**Injection du head (`onShellReady`) :**
- Fonts Google en `<link rel="preload">` (priorité maximale)
- Images LCP critiques en `<link rel="preload">`
- Chunks lazy utilisés via `collector.getTags()` (modulepreload)
- Helmet title/meta/link

**Pattern `res.end()` override** : React 19 appelle `res.end()` après avoir drainé tous les chunks Suspense. L'override intercepte ce point pour injecter `closingTags` (`</div></body></html>`) juste avant la vraie fermeture. Ce pattern non-officiel est requis car Vite gère lui-même le template HTML (transformIndexHtml, HMR preamble) — React ne rend que le contenu de `<div id="root">`.

**Timeout** : 30 secondes (`STREAM_TIMEOUT_MS`). Au-delà, `abort()` est appelé et la réponse est clôturée.

---

### `entry-client.tsx` — hydratation client

Point d'entrée du bundle client. S'exécute après la réception du HTML SSR.

**Séquence d'hydratation :**

1. Import de `@/i18n` (initialisation i18next)
2. Lecture de `window.__CONFIG__` et `window.__REACT_QUERY_STATE__`
3. Écoute HMR : `import.meta.hot.on('config-update', ...)` → met à jour `window.__CONFIG__` et dispatch `site-config-update`
4. `buildRoutes(siteConfig)` **sans** queryClient → mode synchrone, modules core uniquement, retourne `RouteObject[]` directement
5. Si modules optional : retourne une `Promise`, `createBrowserRouter` est créé dans `useEffect`
6. `hydrateRoot(container, <Root />)` — hydrate le DOM SSR avec React

**`Root` component** :
- `useState` pour `QueryClient` (créé une seule fois, staleTime 60s)
- `useState` pour le `router` (sync si routes directes, null si async)
- `useEffect` → `waitForStylesAndHideLoader()` une fois le router prêt
- Arbre rendu : `HelmetProvider > QueryClientProvider > HydrationBoundary > RouterProvider`

**`waitForStylesAndHideLoader()`** : attend que tous les `<link rel="stylesheet">` soient chargés (`sheet !== null`), puis retire `#app-loader` et ajoute `loaded` sur `#root`. Retry toutes les 50ms si les styles ne sont pas encore prêts.

---

### `RootLayout.tsx` — layout racine

Composant monté à la racine de toutes les routes. Reçoit la `SiteConfig` en prop (passée depuis `buildRoutes`).

**Arbre de providers :**

```
ErrorBoundary (fallback générique)
  Suspense
    CocolightProvider           (baseURL depuis getBaseUrl())
      ThemeProvider             (next-themes, defaultTheme depuis config.theme.defaultMode)
        SiteProvider            (config JSON, écoute site-config-update)
          SiteShell
            LocalizationProvider  (defaultLocale, availableLocales depuis config.meta)
              I18nBridge            (sync i18next avec locale courante)
                SiteTheme           (applique les variables CSS de thème)
                GoogleFontsLoader   (injecte les fonts Google en <link>)
                <Outlet />          (routes enfants = pages)
                IntegrationsLoader  (GA4, Intercom, scripts custom)
                Toaster             (sonner)
                DiscourseGlobalModal (lazy, module interop)
                AdminPanel          (lazy, DEV uniquement)
                FloatingQRCode      (lazy, conditionnel config.floatingQRCode.enabled)
                FloatingActionButton (lazy, conditionnel config.floatingActionButton.enabled)
```

**Composants optionnels** : `FloatingQRCode`, `FloatingActionButton`, `DiscourseGlobalModal` et `AdminPanel` sont tous chargés via `lazy()` de vite-preload. `AdminPanel` est défini à `null` en production (`import.meta.env.DEV ? lazy(...) : null`), donc exclu du bundle prod.

---

### Contextes React (`src/contexts/`)

| Contexte | Fichier | Accès | Description |
|---|---|---|---|
| `CocolightContext` | `CocolightContext.tsx` | `useCocolight()` | API Cocolight, entité, user connecté, refreshMe |
| `SiteContext` | `SiteContext.tsx` | `useSite()` | Config JSON + `setConfig` pour live edit |
| `LocalizationContext` | `LocalizationContext.tsx` | `useLocalization()` | Locale courante, setLocale, t(LocalizedString) |
| `PageContext` | `PageContext.tsx` | `usePage()` | Page courante (type `Page`) dans SiteRenderer |

**`CocolightProvider`** — initialise l'API via `useCocolightInit()` (Suspense), écoute les events SDK `userLoggedIn` / `sessionReset` pour mettre à jour l'état. Expose `refreshMe()` pour forcer un re-fetch du user. État memoïsé pour éviter les re-renders inutiles.

**`SiteProvider`** — écoute l'event custom `site-config-update` (émis par entry-client.tsx sur reception HMR) pour mettre à jour la config JSON sans rechargement complet.

**`LocalizationProvider`** — persiste la locale dans `localStorage`. Deux `useEffect` séquentiels : le premier marque `isClient = true`, le second lit localStorage (évite un mismatch SSR/client).

**`I18nBridge`** — synchronise i18next avec `LocalizationProvider` via `i18n.changeLanguage(currentLocale)` dans un `useEffect`. Fournit le contexte `react-i18next` à l'arbre via `I18nextProvider`.

---

### `SiteRenderer.tsx` — rendu de page

Composant rendu pour chaque route de la config JSON et comme fallback `path="*"`.

**Logique de résolution de page :**
1. Lit `pathname` depuis `useLocation()`
2. Cherche `config.pages.find(p => p.path === pathname)`
3. Fallback sur `config.pages[0]` si non trouvé (home)
4. Si `!currentPage` → affiche un 404 minimal inline

**Layout :**
- `layout: "fullwidth"` → `w-full`
- `layout: "default"` (défaut) → `w-full sm:max-w-7xl mx-auto`

**Arbre rendu :**

```
<>
  <Seo page={currentPage} />
  <div className="min-h-screen flex flex-col {layoutClasses}">
    {!currentPage.hideHeader && <SiteHeader />}
    <main id="main" role="main">
      <PageProvidersComposer>
        <PageProvider page={currentPage}>
          {sections.map(s => <SectionRenderer key={s.id} section={s} index={i} />)}
        </PageProvider>
      </PageProvidersComposer>
    </main>
    {!currentPage.hideFooter && <SiteFooter />}
  </div>
</>
```

**`PageProvidersComposer`** : compose les `PageProvider` de tous les modules (depuis `getPageProviders(discoverModules())`) en utilisant `reduceRight` pour respecter l'ordre d'imbrication.

**`usePageGuards(page)`** : évalue les règles `page.auth` (required/roles) et redirige si besoin.

---

### `SiteHeader.tsx` / `SiteFooter.tsx` — variantes de header/footer

Dispatch vers la variante appropriée selon `config.header.type` / `config.footer.type`.

**Headers disponibles** (via `lazy()` de vite-preload) :

`header.type` = une **variante de design** (jamais un nom de site).

| `header.type` | Composant | Fichier |
|---|---|---|
| `"standard"` / `"default"` | `HeaderStandard` | `header/HeaderStandard.tsx` |
| `"mega-menu"` | `HeaderMegaMenu` | `header/HeaderMegaMenu.tsx` |
| `"transparent-scroll"` | `HeaderTransparentScroll` | `header/HeaderTransparentScroll.tsx` |
| `"minimal"` | `HeaderMinimal` | `header/HeaderMinimal.tsx` |
| `"underline-nav"` | `HeaderUnderlineNav` | `header/HeaderUnderlineNav.tsx` |
| `"transparent-dark"` | `HeaderTransparentDark` | `header/HeaderTransparentDark.tsx` |

**Footers disponibles** (via `lazy()` de vite-preload) :

`footer.type` = une **variante de design** (jamais un nom de site).

| `footer.type` | Composant | Fichier |
|---|---|---|
| `"default"` (défaut) | `DefaultFooter` → `FooterRich` | `footer/DefaultFooter.tsx` |
| `"rich"` | `FooterRich` | `footer/FooterRich.tsx` |
| `"minimal-centered"` | `FooterMinimalCentered` | `footer/FooterMinimalCentered.tsx` |
| `"contact-partners"` | `FooterContactPartners` | `footer/FooterContactPartners.tsx` |
| `"sidebar-columns"` (+ `footer.style`: `"plain"` \| `"card"`) | `FooterSidebarColumns` | `footer/FooterSidebarColumns.tsx` |

Tous les variants sont lazy-loadés via `vite-preload`. Pour un site donné, seul le variant actif est téléchargé côté client. Côté SSR, `preloadAll()` les charge tous en mémoire (pas d'impact réseau).

---

### `SectionRenderer.tsx` — rendu de section

Composant qui reçoit un objet `Section` (type + props + id) et rend le composant lazy correspondant.

**Liste complète des 66 types de section enregistrés** (dans `LazySections`) :

| Groupe | Types |
|---|---|
| **Sections génériques** | `hero`, `cards`, `gallery`, `video`, `testimonials`, `pricing`, `faq`, `table`, `blogPost`, `blogList`, `team`, `stats`, `cta`, `logoCloud`, `chart`, `accordion`, `tabs`, `steps`, `timeline`, `banner`, `map`, `newsletter`, `contactForm`, `comparison`, `featureComparison`, `socialFeed`, `eventList`, `productShowcase`, `breadcrumb`, `cookieConsent`, `html`, `markdown`, `title`, `content`, `loginForm`, `registerForm`, `recoverPasswordForm`, `member`, `heroWithIcon`, `gridLayout` |
| **Sections search** | `searchPro`, `searchProStatic`, `cardCountCT`, `thematics`, `filters` |
| **Sections news** | `news` |
| **Sections notification** | `notifications` |
| **Sections ampli** | `meeteem` |
| **Sections coform** | `coform` |
| **Sections cagnotte** | `actions`, `finance`, `actions-summary`, `finance-summary`, `cagnotte-layout` |
| **Sections site-spécifiques** | `hero-tiers-lieux`, `hero-rezo-la-mer`, `hero-ssbe`, `features-rezo-la-mer`, `action-buttons-rezo-la-mer`, `community-rezo-la-mer`, `cta-rezo-la-mer`, `title-with-filters-rezo-la-mer`, `commune-transparente-actions`, `hero-nos-communes`, `hero-commune-transparente`, `categories-grid` |

**Sections project-aware** : `actions`, `finance`, `actions-summary`, `finance-summary` reçoivent un `idProjet` injecté par `SectionRenderer` depuis `contextId` ou les props.

**Fallbacks** :
- Chargement (`Suspense`) : skeleton animé avec barres `bg-muted/40`
- Erreur (`ErrorBoundary`) : fond `bg-destructive/10` avec message
- Type inconnu : message "Section type X not implemented yet" + `console.warn`

**Attributs de tracking admin** : chaque section est enveloppée dans `<div data-section-index={index} data-section-type={section.type}>` pour la mise en surbrillance AdminPanel.

---

### `src/lib/apiClient.ts` — client API Cocolight

Wrapper typé autour du SDK `@communecter/cocolight-api-client`.

**`initApi(options)` / `initApiClient(options)`** :
- **Serveur** : crée des instances fraîches à chaque appel (`storageType: "memory"`) — pas de singleton partagé entre requêtes
- **Client** : singleton via variables module-level — une seule initialisation, promise-cached pour éviter les init concurrentes
- Résolution du slug : `getSlug()` → `me.entityBySlug(slug)` (si connecté) ou `api.entitySlug(slug)` (anonymous)
- Hydratation SSR : si `window.__REACT_QUERY_STATE__` contient `cocolight-data` et que l'utilisateur n'est pas connecté, reconstruit l'entité depuis le JSON via `Cocolight.helper.fromEntityJSON()`

**`resetApiState()`** : remet à zéro le singleton client (utilisé par `entry-server.tsx` pour garantir l'isolation entre requêtes SSR).

**Helpers** : `getApiClient()`, `getUserApi()`, `getApi()` — initialisent si besoin et retournent les singletons typés.

---

### Composants layout auxiliaires

| Composant | Fichier | Rôle |
|---|---|---|
| `IntegrationsLoader` | `IntegrationsLoader.tsx` | Injecte GA4 (gtag.js), Intercom, et scripts custom en `<head>` ou `<body>` selon config |
| `GoogleFontsLoader` | `GoogleFontsLoader.tsx` | Injecte les fonts de `config.theme.typography.fontFamily` via `<link rel="stylesheet">` (client-side, évite le double-injecteur SSR) |
| `ErrorBoundary` | `ErrorBoundary.tsx` | Class component React, accepte `context` pour identifier la source. En dev affiche le message d'erreur ; en prod affiche le `fallback` |
| `FloatingActionButton` | `FloatingActionButton.tsx` | Bouton flottant configurable (label, icon, position, modal) — utilise `useVisibility(condition)` pour l'affichage conditionnel, ouvre un `DynamicModal` du module profil |
| `FloatingQRCode` | `FloatingQRCode.tsx` | QR code flottant avec URL configurable, position, couleurs, favicon optionnel |
| `SiteTheme` | `SiteTheme.tsx` | Applique les variables CSS Tailwind depuis `config.theme` (couleurs, typographie, border-radius) |
| `Seo` | `Seo.tsx` | Génère les balises `<title>`, `<meta name="description">`, Open Graph via `@dr.pogodin/react-helmet` |
| `ClientOnly` | `ClientOnly.tsx` | Wrapper qui ne rend ses enfants qu'après hydratation (équivalent `useIsClient`) |

---

## Utilitaires `src/lib/` (référence)

Fonctions utilitaires internes disponibles dans `src/lib/` — référence rapide.

### Entités SDK

| Fichier | Fonction | Description |
|---|---|---|
| `getTypedEntity.ts` | `isUser(entity)` | Type guard : entity.getEntityType() === "citoyens" |
| `getTypedEntity.ts` | `isOrganization(entity)` | Type guard : entity.getEntityType() === "organizations" |
| `getTypedEntity.ts` | `isProject(entity)` | Type guard : entity.getEntityType() === "projects" |
| `getTypedEntity.ts` | `isEvent(entity)` | Type guard : entity.getEntityType() === "events" |
| `getTypedEntity.ts` | `isPoi(entity)` | Type guard : entity.getEntityType() === "poi" |
| `entityTransform.ts` | `transformToEntityInstance<T>(item, helper, parent)` | Reconvertit un plain object JSON en instance SDK (via `helper.fromEntityJSON`) — idempotent si déjà une instance |
| `entityTransform.ts` | `restorePaginationFromJSON<T>(page, helper, parent)` | Restaure une page de pagination depuis le JSON SSR vers une instance `PaginatorPage<T>` avec méthodes `next`/`prev` |
| `entityFormatting.ts` | `extractAuthorInfo(author)` | Normalise un auteur (entité SDK ou objet brut) vers `{ id, name, photo }` |
| `entityFormatting.ts` | `isEntityInstance(obj)` | Vérifie si l'objet est une entité SDK (a `serverData`) |

**`ENTITY_ICON_CONFIG`** (`entityIcons.tsx`) — source de vérité unique pour les icônes et couleurs par type d'entité :

| Type SDK | Icône Lucide | Couleur |
|---|---|---|
| `organizations` | `Building2` | `text-purple-500` |
| `projects` | `Briefcase` | `text-blue-500` |
| `events` | `Calendar` | `text-orange-500` |
| `poi` | `MapPin` | `text-green-500` |
| `citoyens` | `User` | `text-primary` |

### HTML et images

| Fichier | Fonction | Description |
|---|---|---|
| `sanitize.ts` | `sanitize(html)` | Nettoie du HTML arbitraire via `isomorphic-dompurify` (SSR + client) |
| `imageUtils.ts` | `buildOptimizedUrl(src, { w, h, q, f })` | Construit une URL `/img?url=...` pour le middleware d'optimisation. Bypass SVG, data URIs et blob |

### Routing et état

| Fichier | Fichier source | Description |
|---|---|---|
| `queryKeys.ts` | `src/lib/queryKeys.ts` | Constantes des clés React Query partagées entre modules |
| `toastUtils.ts` | `src/lib/toastUtils.ts` | Helpers pour les notifications sonner |
| `confetti.ts` | `src/lib/confetti.ts` | Lance une animation confetti (module cagnotte) |
| `fundingProjectUtils.ts` | `src/lib/fundingProjectUtils.ts` | Calculs de financement (pourcentage atteint, formatage montant) |

### Helpers du module search (source unique)

Ces utilitaires dans `src/modules/search/` sont la source de vérité pour la logique de recherche, partagée entre les sections `searchPro`, `searchProStatic`, le hero `hero-tiers-lieux`, et le prefetch SSR.

| Utilitaire | Fichier | Description |
|---|---|---|
| `buildSearchPayload` | `lib/buildSearchPayload.ts` | Construit le payload `searchCostum` depuis `baseParams` + state courant. Utilisé par `useSearchQuery` et `useAutocomplete` — garantit la coherence entre la liste et l'autocompletion. |
| `searchByFieldsToQuery` | `lib/searchByFieldsToQuery.ts` | Prend `searchByFields: Record<string, SearchByFieldValue>` (filtres dynamiques du `PageFilters`) et retourne `{ filters, locality, sourceKeys }` — dispatch selon le `type` de chaque entrée (`scopeList` → `locality`, `sourceKey` → `sourceKeys`, form-based → `filters` MongoDB). Source unique partagée par `SearchProStatic` et `useAutocomplete`. |
| `computeFiltersFromUrl` | `lib/computeFiltersFromUrl.ts` | Traduit les query params d'URL en mutations `PageFilters`. Signature : `(searchParams, filterGroups, filterAnswerData)` → `{ applySelected, applySearchFields }`. Itère sur les `groupId` arbitraires issus de `filterGroups` (typologies, entityList, services form-based) ; les params `q`/`tags`/`type`/`map` sont gérés par le loader de `buildRoutes.tsx`, pas ici. |
| `usePageFiltersUrlSync` | `hooks/usePageFiltersUrlSync.ts` | Applicateur headless **unidirectionnel URL → PageFilters** : lit les query params, appelle `computeFiltersFromUrl` et publie le résultat dans `PageFiltersContext`. Rattaché à `FiltersSection` (page `/lieux`) et à la home via le hero — pas spécifique à `searchPro`. |
| `useAutocomplete` | `hooks/useAutocomplete.ts` | Autocompletion scopée réseau. Partagee par la barre de recherche et le hero `hero-tiers-lieux`. |
| `findFiltersSections` | `prefetch/prefetchFilters.ts` | Recherche récursive de toute section déclarant `filterGroups`/`filtersByAnswers`/`filtersByPath` pour le prefetch SSR (générique — pas de cas en dur par `type`). |

---

## Voir aussi

- [Configuration](02-configuration.md)
- [Schéma principal](04-schema-principal.md)
- [Sections dynamiques](06-sections-dynamiques.md)
- [Backend & SSR](14-backend-ssr.md)
- [Admin Panel](24-admin-panel.md)
- [Permissions](10-permissions.md)
