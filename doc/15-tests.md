[← Retour à l'index](README.md)

# Architecture de tests

**Sommaire**

- [Architecture de tests](#architecture-de-tests)
  - [Vue d'ensemble](#vue-densemble)
  - [Commandes de test](#commandes-de-test)
  - [Arborescence des fichiers de test](#arborescence-des-fichiers-de-test)
  - [Configuration Vitest](#configuration-vitest)
  - [Configuration Playwright](#configuration-playwright)
  - [Approche config-driven](#approche-config-driven)
    - [Principe](#principe)
    - [Helper partagé `e2e/helpers/config.ts`](#helper-partagé-e2ehelpersconfigts)
    - [Fonctions utilitaires](#fonctions-utilitaires)
    - [Usage dans les tests E2E](#usage-dans-les-tests-e2e)
    - [Usage dans les tests d'intégration](#usage-dans-les-tests-dintégration)
  - [Pattern `navigateToLoginForm`](#pattern-navigatetologinform)
  - [Tests d'intégration SSR](#tests-dintégration-ssr)
    - [Gestion du serveur de test](#gestion-du-serveur-de-test)
    - [Tests SSR config-driven (`config-driven-ssr.test.ts`)](#tests-ssr-config-driven-config-driven-ssrtestts)
    - [Tests SSR de rendu (`ssr-rendering.test.ts`)](#tests-ssr-de-rendu-ssr-renderingtestts)
    - [Tests de complétude SSR (`ssr-completeness.test.ts`)](#tests-de-complétude-ssr-ssr-completenesstestts)
    - [Tests de concurrence SSR (`ssr-concurrency.test.ts`)](#tests-de-concurrence-ssr-ssr-concurrencytestts)
  - [Tests unitaires](#tests-unitaires)
    - [`src/lib/__tests__/`](#srcliblib__tests__)
    - [Modules — tests unitaires](#modules--tests-unitaires)
    - [Preflight tests (`tests/preflight/`)](#preflight-tests-testspreflight)
  - [Tests E2E par domaine](#tests-e2e-par-domaine)
    - [Recherche (`search.spec.ts`)](#recherche-searchspects)
    - [Authentification (`auth-flow.spec.ts`, `auth-real.spec.ts`)](#authentification-auth-flowspects-auth-realspects)
    - [Profil (`profile.spec.ts`)](#profil-profilespects)
    - [Hydratation (`hydration.spec.ts`)](#hydratation-hydrationspects)
    - [Navigation (`config-nav.spec.ts`)](#navigation-config-navspects)
    - [i18n (`i18n.spec.ts`)](#i18n-i18nspects)
  - [Ce qui reste hardcodé et pourquoi](#ce-qui-reste-hardcodé-et-pourquoi)
  - [Variables d'environnement de test](#variables-denvironnement-de-test)
  - [Guide : Ajouter un nouveau test config-driven](#guide--ajouter-un-nouveau-test-config-driven)
  - [Voir aussi](#voir-aussi)

---

> Note : Un résumé opérationnel de l'architecture de tests est également disponible dans [CLAUDE.md](../CLAUDE.md#testing-architecture), optimisé pour l'utilisation avec Claude Code.

## Vue d'ensemble

SiteForge utilise une stratégie de tests à **trois niveaux**, tous pilotés par la configuration JSON (`config.prod.json`) pour garantir que les tests restent valides quand la configuration change.

| Niveau | Runner | Cible | Durée typique |
|--------|--------|-------|---------------|
| **Unit** | Vitest | Logique pure, fonctions utilitaires, hooks, composants (`src/` + `server/`) | < 5s |
| **Preflight** | Vitest | Validation env, configs JSON, schéma Zod, toutes les configs de `sites.json`, anti-régressions bundle | < 1s (ou après build) |
| **Integration SSR** | Vitest | Rendu serveur, concurrence, complétude HTML, state hydraté | ~20s |
| **E2E** | Playwright | Navigation browser, formulaires, hydratation client | ~2min |

## Commandes de test

| Commande | Description |
|----------|-------------|
| `npm run test:unit` | Tests unitaires + preflight + server (Vitest, `vitest.config.unit.ts`) |
| `npm run test:integration` | Tests d'intégration SSR avec serveur dédié (Vitest, `vitest.config.integration.ts`) |
| `npm run test:e2e` | Tests end-to-end navigateur (Playwright) |
| `npm run test:all` | Exécute les trois niveaux séquentiellement |
| `npm run test:preflight` | Preflight uniquement — `vitest run -c vitest.config.unit.ts tests/preflight/` |
| `npm run test:coverage` | Tests unitaires avec rapport de couverture V8 (HTML + JSON) |
| `npm run test:watch` | Mode watch avec `vitest.config.ts` par défaut (`src/` + `tests/`, sans `.tsx` ni `server/`) |

Pour les tests E2E avec authentification backend réelle :

```bash
source .env.test && npm run test:e2e
```

## Arborescence des fichiers de test

```
.
├── src/lib/__tests__/
│   ├── apiClient.test.ts           # Singleton API client, isolation server/client
│   ├── buildRoutes.test.tsx        # buildRoutes sync/async, route normalisation, catch-all
│   ├── configValidation.test.ts    # Validation schéma Zod
│   ├── entityTransform.test.ts     # transformToEntityInstance, restorePaginationFromJSON
│   ├── modules.test.tsx            # discoverModules, getModuleRoutes(Sync), getPageProviders
│   ├── permissions.test.ts         # Registre permissions (register, get, overwrite)
│   ├── sanitize.test.ts            # Tests XSS (scripts, event handlers, iframes)
│   ├── visibility.test.ts          # useVisibility : auth, routes, excludeRoutes, permissions
│   └── pageState/
│       └── createPageActionsState.test.tsx  # Hooks de page state partagé
├── src/modules/
│   ├── ampli/
│   │   ├── helpers/summary.test.ts                      # Helpers de résumé Ampli
│   │   ├── utils/cardFilters.test.ts                    # Filtres de cards Ampli
│   │   └── components/sections/parts/
│   │       ├── MeeteemCard.test.tsx         # Composant card Meeteem
│   │       ├── MeeteemFilters.test.tsx      # Composant filtres Meeteem
│   │       ├── MeeteemMapPlaceholder.test.tsx # Placeholder carte Meeteem
│   │       └── MeeteemViewToggle.test.tsx   # Toggle vue Meeteem
│   ├── auth/hooks/__tests__/
│   │   └── useSSOAuth.test.ts               # Hook SSO auth
│   ├── cagnotte/
│   │   ├── lib/actionDiffCalculator.test.ts  # Calcul de diff entre actions
│   │   ├── lib/actionIdResolvers.test.ts     # Résolution d'IDs d'actions
│   │   └── utils/
│   │       ├── actionDateHelpers.test.ts     # Helpers dates d'actions
│   │       ├── dataTransform.test.ts         # Transformation données cagnotte
│   │       ├── format.test.ts                # Formatage montants/affichage
│   │       └── idGeneration.test.ts          # Génération d'IDs
│   ├── coform/
│   │   ├── components/SmartCoForm.test.tsx   # Composant principal CoForm
│   │   ├── contexts/CoFormProvider.test.tsx  # Provider contexte CoForm
│   │   ├── hooks/useConditionalFields.test.ts  # Champs conditionnels
│   │   ├── hooks/useFinderSearchResults.test.tsx # Résultats finder
│   │   ├── permissions/calculators/coform.test.ts # Permissions CoForm
│   │   └── utils/
│   │       ├── formParser.test.ts            # Parsing schéma de form
│   │       ├── helpers.test.ts               # Fonctions utilitaires CoForm
│   │       ├── toFinderSearchResult.test.ts  # Conversion résultat finder
│   │       └── toRelativeImageUrl.test.ts    # Normalisation URLs d'images
│   ├── interop/hooks/
│   │   ├── useDiscourseAutoDetect.test.ts    # Détection auto Discourse
│   │   └── useInteropConfigQuery.test.ts     # Query config interop
│   ├── news/permissions/calculators/
│   │   └── news.test.ts                      # Permissions news (6 perms)
│   ├── notification/utils/
│   │   ├── formatTimeAgo.test.ts             # Formatage temps relatif
│   │   ├── notificationTabIntent.test.ts     # Résolution verb→tab
│   │   └── parseNotification.test.ts         # Parsing objet notification
│   ├── profil/
│   │   ├── permissions/calculators/profil.test.ts  # Permissions profil (48 perms)
│   │   └── utils/tiersLieuxMapping.test.ts   # Mapping Tiers-Lieux
│   └── search/
│       ├── hooks/useFiltersByAnswers.test.ts  # Hook filtres par réponses
│       ├── hooks/useSearchQuery.test.tsx      # Hook query de recherche
│       └── lib/canonicalBaseParams.test.ts   # Paramètres canoniques
├── server/__tests__/
│   └── imageOptimizer.test.ts      # Fonctions pures (allowlist, format, magic bytes, MIME)
├── tests/
│   ├── preflight/
│   │   ├── bundle-size.test.ts     # Taille chunks, vendor splits, pas d'icons-vendor (skip si pas de build)
│   │   ├── environment.test.ts     # Vérification Node, deps, fichiers config
│   │   ├── no-import-star-lucide.test.ts  # Anti-régression tree-shaking lucide-react
│   │   └── sites-configs.test.ts   # Validation de TOUTES les configs de sites.json
│   ├── helpers/
│   │   ├── global-setup.ts         # Démarre le serveur SSR sur port 5188
│   │   └── server-manager.ts       # Expose getBaseUrl() pour les tests intégration
│   └── integration/
│       ├── config-driven-ssr.test.ts   # SSR par page config, meta, nav, sections
│       ├── ssr-completeness.test.ts    # Complétude HTML (</html>, doctype, root, globals, markers Suspense)
│       ├── ssr-concurrency.test.ts     # 10-20 requêtes parallèles, cross-route leakage
│       └── ssr-rendering.test.ts       # SSR home + pages secondaires + 404
├── e2e/
│   ├── global-setup.ts             # Warmup du dev server Playwright (3 requêtes)
│   ├── helpers/
│   │   └── config.ts               # Helper partagé config-driven (loadSiteConfig, etc.)
│   ├── auth-flow.spec.ts           # Auth avec mocks API (login/logout flow)
│   ├── auth-real.spec.ts           # Auth avec vrai backend (skip si pas de credentials)
│   ├── config-nav.spec.ts          # Header nav, footer, logo (config-driven)
│   ├── hydration.spec.ts           # SSR sans JS, hydratation, window globals
│   ├── i18n.spec.ts                # Langue par défaut, switch de langue
│   ├── profile.spec.ts             # Pages profil + validation config.profiles
│   └── search.spec.ts              # Sections searchPro/searchProStatic/gridLayout
├── vitest.config.unit.ts           # Config Vitest pour unit + preflight + server (+ setupFiles UI)
├── vitest.config.integration.ts    # Config Vitest pour intégration (globalSetup, timeout 60s)
├── vitest.config.ts                # Config Vitest par défaut (src + tests, timeout 30s, utilisé par test:watch)
└── playwright.config.ts            # Config Playwright (chromium, webServer dev)
```

## Configuration Vitest

**`vitest.config.unit.ts`** : Tests unitaires rapides.

```ts
test: {
  environment: "node",
  setupFiles: ["./tests/setup-ui.ts"],  // Charge @testing-library/jest-dom pour tous les tests
  include: [
    "src/**/*.test.ts",
    "src/**/*.test.tsx",
    "tests/preflight/**/*.test.ts",
    "server/**/*.test.ts",
  ],
}
```

L'environnement par défaut est `"node"`. Les fichiers `.test.tsx` qui testent des composants React ajoutent `// @vitest-environment jsdom` en tête de fichier pour activer le DOM.

**`vitest.config.integration.ts`** : Tests SSR avec serveur dédié.

```ts
test: {
  environment: "node",
  include: ["tests/**/*.test.ts"],
  testTimeout: 60_000,
  fileParallelism: false,               // Séquentiel : partage un seul serveur
  globalSetup: ["tests/helpers/global-setup.ts"],  // Démarre le serveur sur port 5188
}
```

**`vitest.config.ts`** : Config par défaut utilisée par `npm test` et `npm run test:watch`.

```ts
test: {
  environment: "node",
  include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  testTimeout: 30_000,
}
```

Note : `test:watch` utilise cette config (pas `vitest.config.unit.ts`) car la commande est `vitest --watch` sans flag `-c`. Elle couvre les tests `src/` et `tests/` mais pas les `.test.tsx` ni `server/`.

## Configuration Playwright

```ts
// playwright.config.ts
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",    // Warmup du dev server
  fullyParallel: false,                     // Séquentiel (1 worker)
  forbidOnly: !!process.env.CI,             // Interdit .only en CI
  retries: process.env.CI ? 2 : 0,         // 2 retries en CI, 0 en local
  workers: 1,
  reporter: "html",                         // Rapport HTML
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",                // Trace Playwright au 1er retry
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },  // Émulation Desktop Chrome
    },
  ],
  webServer: {
    command: "npm run dev",                 // Démarre le dev server automatiquement
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,   // Réutilise si déjà lancé en local
    timeout: 60_000,
  },
});
```

## Approche config-driven

### Principe

Les tests **ne hardcodent jamais** de chemins comme `/lieux` ou `/login`. Ils dérivent toutes les URLs et assertions de `config.prod.json`. Ainsi, si la config change (renommage de page, ajout de routes), les tests s'adaptent automatiquement.

**Avant** (fragile) :
```ts
await page.goto("/lieux");  // Casse si la page est renommée
```

**Après** (config-driven) :
```ts
const searchPages = findSearchPages(config);
for (const searchPage of searchPages) {
  test(`${searchPage.path} renders`, async ({ page }) => {
    await page.goto(searchPage.path);
  });
}
```

### Helper partagé `e2e/helpers/config.ts`

Ce module charge la config JSON une seule fois (cache en mémoire) et expose des fonctions utilitaires pour tous les specs E2E. Il charge automatiquement le `.env` pour résoudre `SITE_CONFIG_PATH` si cette variable n'est pas déjà définie (Playwright ne charge pas le `.env` nativement).

```ts
import { loadSiteConfig, findSearchPages, findLoginPath } from "./helpers/config";

const config = loadSiteConfig();
```

**Types exportés** :

| Type | Description |
|------|-------------|
| `SiteConfig` | Structure racine de la config (meta, header, pages, footer, profiles) |
| `SitePage` | Une page avec path, title, sections |
| `SiteSection` | Une section avec type, id, props |
| `NavItem` | Item de navigation (récursif avec children) |

### Fonctions utilitaires

| Fonction | Signature | Description |
|----------|-----------|-------------|
| `loadSiteConfig()` | `() => SiteConfig` | Charge et cache `config.prod.json` |
| `findPageBySection(config, sectionType)` | `(SiteConfig, string) => SitePage \| undefined` | Trouve la 1re page contenant un type de section |
| `findLoginPath(config)` | `(SiteConfig) => string \| undefined` | Chemin de la page avec section `loginForm` |
| `findSearchPages(config)` | `(SiteConfig) => SitePage[]` | Pages avec `searchPro`, `searchProStatic` ou `gridLayout` |
| `getAllNavPaths(config)` | `(SiteConfig) => string[]` | Tous les paths du header nav (aplatis, sans `#`) |
| `findSecondaryPage(config)` | `(SiteConfig) => SitePage \| undefined` | 1re page avec `path !== "/"` |

### Usage dans les tests E2E

**`search.spec.ts`** : Boucle sur les pages search trouvées dans la config :

```ts
const searchPages = findSearchPages(config);

for (const searchPage of searchPages.filter((p) => p.path !== "/")) {
  test(`${searchPage.path} renders search/grid content`, async ({ page }) => {
    await page.goto(searchPage.path);
    // assertions...
  });
}
```

**`hydration.spec.ts`** : Utilise la page secondaire au lieu de hardcoder `/lieux` :

```ts
const secondaryPage = findSecondaryPage(config);
const secondaryPath = secondaryPage?.path ?? "/lieux"; // fallback ultime

test(`hydration on ${secondaryPath}`, async ({ page }) => {
  await page.goto(secondaryPath);
});
```

**`auth-flow.spec.ts` / `auth-real.spec.ts`** : Cherche la page login dans la config :

```ts
const loginPath = findLoginPath(config);
// Si trouvé → page.goto(loginPath)
// Sinon → fallback: cliquer "Se connecter" depuis "/"
```

### Usage dans les tests d'intégration

**`ssr-rendering.test.ts`** : Boucle sur toutes les pages secondaires :

```ts
const secondaryPages = config.pages.filter((p) => p.path !== "/");

for (const page of secondaryPages) {
  describe(`${page.path}`, () => {
    it("returns 200 with SSR content", async () => {
      const { status, html } = await fetchPage(`${getBaseUrl()}${page.path}`);
      expect(status).toBe(200);
    });
  });
}
```

**`ssr-concurrency.test.ts`** : Construit les routes de test depuis la config :

```ts
const configRoutes = config.pages.map((p) => p.path);
const mixedRoutes = [...configRoutes, "/page-inexistante"];

// 20 requêtes parallèles sur toutes les routes config + fallback
```

## Pattern `navigateToLoginForm`

Les deux specs d'authentification implémentent chacune un helper `navigateToLoginForm()` local avec une stratégie à deux niveaux, mais avec des signatures légèrement différentes.

**`auth-flow.spec.ts`** — retourne `Promise<boolean>` :

1. Si `findLoginPath(config)` retourne un chemin, navigue vers cette page et vérifie qu'un `input[type="email"]` est visible → retourne `true`
2. Sinon, navigue vers `/` et clique le bouton "Se connecter" → retourne `true`
3. Si rien n'est trouvé → retourne `false` (le test appelant fait `test.skip()`)

```ts
async function navigateToLoginForm(page: Page): Promise<boolean> {
  if (loginPath) {
    await page.goto(loginPath, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const emailInput = page.locator('input[type="email"]').first();
    if ((await emailInput.count()) > 0) return true;
  }

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const loginButton = page.getByRole("button", { name: /Se connecter/i });
  if ((await loginButton.count()) > 0) {
    await loginButton.first().click();
    await page.waitForTimeout(500);
    return true;
  }

  return false;
}
```

**`auth-real.spec.ts`** — retourne `Promise<void>` :

Même stratégie deux niveaux, mais sans valeur de retour. Le skip est géré dans `beforeEach` (backend injoignable ou credentials absents) plutôt qu'en vérifiant le retour de la fonction.

## Tests d'intégration SSR

### Gestion du serveur de test

Le fichier `tests/helpers/global-setup.ts` :
- Démarre un serveur de dev sur le **port 5188** (distinct du port 5173 du dev local)
- Fait un warmup (5 tentatives) pour s'assurer que le SSR est stable
- Arrête le serveur via SIGTERM/SIGKILL à la fin des tests

Le fichier `tests/helpers/server-manager.ts` expose `getBaseUrl()` qui retourne `http://localhost:5188`.

### Tests SSR config-driven (`config-driven-ssr.test.ts`)

Le test le plus complet : vérifie que **chaque page** de la config produit un SSR valide.

- **Pages** : Boucle sur `config.pages`, vérifie 200 + `#root` + `window.__CONFIG__`
- **Meta** : `<title>` contient `config.meta.title[defaultLang]`
- **Nav vers pages** : Les items nav qui pointent vers des pages config rendent en SSR
- **Section types** : Chaque type de section utilisé dans config est enregistré dans `SectionRenderer.tsx`
- **Footer** : Le copyright apparaît dans le HTML SSR

### Tests SSR de rendu (`ssr-rendering.test.ts`)

Vérifie le rendu SSR de base :
- `/` : status 200, `<title>`, `#root` non-vide, `window.__CONFIG__`, `window.__REACT_QUERY_STATE__`, viewport meta
- **Pages secondaires** (config-driven) : 200 + contenu SSR complet
- `/page-inexistante` : 200 (catch-all, pas de 404 HTTP)
- Assets statiques inexistants : 404
- Content-Type : `text/html`

### Tests de complétude SSR (`ssr-completeness.test.ts`)

Anti-régression du fix de streaming React 19 + Vite (`pipe(res)` direct + override `res.end()`). Teste la home + les 2 premières pages secondaires de la config.

**Toujours actifs (mode dev)** :
- Le HTML se termine par `</html>` (closing tags injectés correctement)
- Contient `<!doctype html>` en tête
- `<div id="root">` est non vide (contenu SSR > 100 caractères)
- `window.__CONFIG__` injecté
- `window.__REACT_QUERY_STATE__` injecté
- Structure globale : `<html>`, `<head>`, `<body>` dans l'ordre, et tags fermants

**Activés uniquement avec `STRICT_SSR_MARKERS=1`** (à utiliser avec un serveur prod) :
- Aucun marker Suspense pending `<!--$?-->` résiduel
- Aucun marker boundary failed `<!--$!-->`

### Tests de concurrence SSR (`ssr-concurrency.test.ts`)

Stress-test du pipeline SSR streaming :
- 1 requête : vérifie les globals et `#root`
- 10 requêtes parallèles sur `/` : toutes 200 avec state parseable
- 20 requêtes parallèles sur routes mixtes (config + fallback) : pas de troncature
- 5 requêtes parallèles : state déshydraté contient `cocolight-data` query
- Cross-route leakage : `/` et page secondaire en parallèle ne mélangent pas leur contenu

## Tests unitaires

### `server/__tests__/`

#### ImageOptimizer (`server/__tests__/imageOptimizer.test.ts`)

Teste les 5 fonctions pures exportées du middleware d'optimisation d'images (37 tests) :

- **`buildAllowlist()`** : construction de la whitelist de domaines depuis les variables d'environnement (localhost par défaut, `VITE_BASE_URL_BACKEND`, `IMAGE_OPTIMIZER_ALLOWED_DOMAINS`)
- **`isDomainAllowed()`** : vérification qu'une URL distante est dans la whitelist (sécurité SSRF)
- **`negotiateFormat()`** : négociation du format de sortie via le header Accept (AVIF > WebP > JPEG)
- **`detectImageType()`** : détection du vrai type d'image par magic bytes (PNG, JPEG, WebP, GIF, TIFF, AVIF). Retourne `null` pour du HTML ou des buffers invalides.
- **`mimeFromPath()`** : déduction du type MIME depuis l'extension de fichier

### `src/lib/__tests__/`

#### Sanitize (`src/lib/__tests__/sanitize.test.ts`)

Teste la fonction `sanitize()` contre les vecteurs XSS classiques (16 tests) :

- Suppression des `<script>`, `<iframe>`, `<object>`
- Suppression des event handlers (`onclick`, `onerror`, `onload`, `onmouseover`)
- Suppression des `javascript:` URI dans les href
- Préservation du HTML safe (`<p>`, `<strong>`, `<a href>`)
- Payloads XSS : `<img src=x onerror=alert(1)>`, `<svg onload=alert(1)>`, etc.

#### Permissions (`src/lib/__tests__/permissions.test.ts`)

Teste le registre central des calculateurs de permissions (10 tests) :

- `registerPermissions()` + `getCalculator()` : enregistrement et récupération
- `hasCalculator()` : existence d'un namespace
- `getAllCalculators()` : liste complète
- Overwrite : ré-enregistrement du même namespace → `console.warn` + remplacement
- Namespace inconnu → `undefined`
- `_resetForTesting()` : nettoyage entre les tests
- Le contexte (`entity`, `me`, `data`) est bien passé au calculateur

#### API Client (`src/lib/__tests__/apiClient.test.ts`)

Teste la logique singleton vs isolation du client API :

- **Serveur** (`typeof window === 'undefined'`) : chaque appel retourne une instance distincte (pas de cache), isolation complète entre requêtes parallèles, `storageType: 'memory'`
- **Client** (`typeof window !== 'undefined'`) : singleton — le deuxième appel retourne la même instance, `resetApiState()` force une nouvelle initialisation, `getApiClient/getUserApi/getApi` retournent les singletons, `storageType: 'localStorage'`

#### buildRoutes (`src/lib/__tests__/buildRoutes.test.tsx`)

Teste la construction de l'arborescence React Router à partir de la config JSON :

- **Mode synchrone** : retourne `RouteObject[]` (pas une Promise), route racine `/` avec children, normalisation des paths (`/` → `""`, `/about` → `"about"`), catch-all `*`, routes de modules core intégrées
- **Mode asynchrone** (avec `queryClient`) : retourne une `Promise<RouteObject[]>`, loader attaché sur chaque route de page, routes de modules incluses
- **Détection optional** : force le mode async dès qu'un module `optional` est présent, même sans `queryClient`

#### Modules (`src/lib/__tests__/modules.test.tsx`)

Teste les helpers de découverte et chargement de modules :

- `discoverModules()` : retourne un array de modules typés, inclut au moins `profil`, exclut les modules `enabled: false`
- `getModuleRoutesSync()` : collecte les routes core synchrones, throw si module optional passé
- `getModuleRoutes()` (async) : inclut routes core et optional (await du loader), skip modules sans routes
- `getPageProviders()` : collecte les `PageProvider` déclarés dans `module.config.PageProvider`

#### entityTransform (`src/lib/__tests__/entityTransform.test.ts`)

- `transformToEntityInstance()` : passthrough si instance déjà typée, wrapping via `helper.fromEntityJSON`, fallback safe si throw
- `restorePaginationFromJSON()` : passthrough si déjà restaurée (`_entity.getEntityType` présent), wrapping sinon, fallback safe

#### Visibility (`src/lib/__tests__/visibility.test.ts`) — `@vitest-environment jsdom`

- **VisibilityConditionSchema** : accepte `auth: required|anonymous|any`, `routes`, `excludeRoutes`, `permissions` comme arrays ; refuse les valeurs invalides
- **useVisibility hook** : conditions `auth`, `routes` (avec wildcard `/profil/*`), `excludeRoutes` (prioritaire sur `routes`), `permissions`, combinaisons AND, masquage pendant SSR (`hydrated=false`)

### Modules — tests unitaires

#### CoForm helpers (`src/modules/coform/utils/helpers.test.ts`)

24 tests pour les fonctions utilitaires du module CoForm :

- `convertBootstrapWidth()` : conversion `col-md-6` → `w-1/2`, fallback `w-full`
- `generateFieldId()` : génère des IDs prévisibles (`subFormId_fieldKey`)
- `extractMongoId()` : extrait l'`$id` d'un `{ $id: "..." }` ou retourne la string directement
- `formatTimestamp()` : timestamps Unix → date lisible locale
- `isStepComplete()` : vérifie que tous les champs requis sont non-vides
- `mergeStepsData()` : fusionne les données de plusieurs étapes en un objet plat

D'autres tests CoForm couvrent : `formParser.test.ts` (parsing schéma de form), `toRelativeImageUrl.test.ts`, `toFinderSearchResult.test.ts`, `CoFormProvider.test.tsx`, `SmartCoForm.test.tsx`, `useConditionalFields.test.ts`, `useFinderSearchResults.test.tsx`, `permissions/calculators/coform.test.ts`.

#### Ampli (`src/modules/ampli/`)

- `helpers/summary.test.ts` : helpers de résumé
- `utils/cardFilters.test.ts` : filtres de cards
- `components/sections/parts/MeeteemCard.test.tsx` : composant card
- `components/sections/parts/MeeteemFilters.test.tsx` : composant filtres
- `components/sections/parts/MeeteemMapPlaceholder.test.tsx` : placeholder carte
- `components/sections/parts/MeeteemViewToggle.test.tsx` : toggle de vue

#### Cagnotte (`src/modules/cagnotte/`)

- `lib/actionDiffCalculator.test.ts` : calcul de diff entre états d'actions
- `lib/actionIdResolvers.test.ts` : résolution d'IDs d'actions
- `utils/actionDateHelpers.test.ts` : helpers sur les dates d'actions
- `utils/dataTransform.test.ts` : transformation des données cagnotte
- `utils/format.test.ts` : formatage montants et affichage
- `utils/idGeneration.test.ts` : génération d'IDs

#### Notification (`src/modules/notification/utils/`)

- `formatTimeAgo.test.ts` : formatage du temps relatif
- `parseNotification.test.ts` : parsing de l'objet notification
- `notificationTabIntent.test.ts` : résolution verb→tab pour la redirection

#### Search (`src/modules/search/`)

- `hooks/useFiltersByAnswers.test.ts` : hook filtres par réponses
- `hooks/useSearchQuery.test.tsx` : hook query de recherche
- `lib/canonicalBaseParams.test.ts` : construction des paramètres canoniques

#### Permissions par module

- `src/modules/profil/permissions/calculators/profil.test.ts` : 48 permissions profil (canEditProfile, isMember, isAdmin, etc.)
- `src/modules/news/permissions/calculators/news.test.ts` : 6 permissions news (canAddNews, canEditNews, canDeleteNews, etc.)

#### Autres modules

- `src/modules/auth/hooks/__tests__/useSSOAuth.test.ts` : hook SSO auth
- `src/modules/interop/hooks/useDiscourseAutoDetect.test.ts` : détection auto Discourse
- `src/modules/interop/hooks/useInteropConfigQuery.test.ts` : query config interop
- `src/modules/profil/utils/tiersLieuxMapping.test.ts` : mapping Tiers-Lieux

### Preflight tests (`tests/preflight/`)

#### Validation configs multi-sites (`tests/preflight/sites-configs.test.ts`)

Valide automatiquement **toutes** les configs référencées dans `sites.json` (66 tests) :

**Intégrité de `sites.json`** :
- Format valide (array non-vide)
- Chaque entrée a `slug`, `config`, `css`
- Pas de slugs dupliqués

**Pour chaque config JSON** (dédupliquées si plusieurs slugs partagent la même config) :
- Le fichier existe
- Le JSON est valide
- Passe le schéma Zod `SiteConfigSchema`
- Au moins une page avec `path: "/"`
- Pas de chemins de page dupliqués

**Pour chaque fichier CSS** référencé :
- `src/{css}.css` existe

Ce test détecte automatiquement les problèmes de désynchronisation entre `sites.json`, les configs JSON et le schéma Zod.

#### Anti-régression Lucide tree-shaking (`tests/preflight/no-import-star-lucide.test.ts`)

Scanne statiquement tous les fichiers `src/` (`.ts`, `.tsx`, `.js`, `.jsx`) pour détecter `import * as X from "lucide-react"` ou `import * as X from "lucide-react/icons"`.

- Si une de ces formes est trouvée → le test échoue et liste les fichiers coupables
- Garde-fou : vérifie que le scan a effectivement trouvé plus de 100 fichiers (détecte un walk silencieusement vide)

Voir [CLAUDE.md§Known Issues 1](../CLAUDE.md#known-issues--gotchas) pour le contexte : ce pattern défait le tree-shaking et injecte ~1 MB d'icônes dans le chunk concerné.

#### Taille des bundles (`tests/preflight/bundle-size.test.ts`)

Skippé automatiquement si `dist/client/assets/` n'existe pas. Lancer après `npm run build`.

- Aucun chunk `icons-vendor*.js` (régression manualChunks lucide-react supprimée)
- Les vendor chunks attendus existent : `react-vendor`, `ui-vendor`, `query-vendor`, `form-vendor`, `utils-vendor`, `i18n-vendor`
- `react-vendor` reste sous 600 KB non-gzip (React 19 + React DOM + React Router v7 ≈ 460 KB)
- Le bundle principal (`index-*.js`) ne dépasse pas 2 MB
- Plus de 500 chunks JS au total (signe que le lazy-loading fonctionne)

## Tests E2E par domaine

### Recherche (`search.spec.ts`)

- **Skip** si le backend n'est pas joignable
- `/` : Les sections `searchProStatic` rendent sans crash
- **Pages search** (config-driven) : Chaque page contenant `searchPro`/`searchProStatic`/`gridLayout` rend correctement
- Input de recherche dans le hero : fonctionnel (fill + vérification valeur)

### Authentification (`auth-flow.spec.ts`, `auth-real.spec.ts`)

**`auth-flow.spec.ts`** (avec mocks API) :
- Le bouton "Se connecter" est visible dans le header
- Cliquer dessus affiche un formulaire email/password
- Credentials corrects : dialog fermé, état connecté
- Credentials incorrects : toast d'erreur
- Logout : retour à l'état "Se connecter" visible

**`auth-real.spec.ts`** (backend réel) :
- **Skip** si `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` non définis ou backend injoignable
- Login avec vrais credentials
- `/api/person/me` retourne des données valides
- Login avec mauvais password : toast d'erreur
- Login puis logout

### Profil (`profile.spec.ts`)

Séparé en deux `describe` indépendants :

**Profile Config** (pas besoin du backend) :
- `config.profiles` est défini avec au moins un type (skip gracieux si absent)
- Chaque type de profil a des tabs configurés

**Profile Pages E2E** (backend requis, skip si injoignable) :
- `/profil/{VITE_SLUG}` rend une page profil
- `/profil/slug-inexistant-xyz` ne crash pas (error boundary)
- Le chemin `/profil/` reste hardcodé car défini dans le module code, pas dans la config JSON

### Hydratation (`hydration.spec.ts`)

- SSR rend du contenu sans JS (`javaScriptEnabled: false`)
- Hydratation sans erreurs critiques (pas de mismatch)
- `window.__CONFIG__` a la forme attendue (meta, pages, header)
- `window.__REACT_QUERY_STATE__` contient des queries
- Navigation client-side sans full page reload (vers page secondaire config-driven)
- Hydratation sans erreurs sur la page secondaire config-driven

### Navigation (`config-nav.spec.ts`)

- Header visible avec logo linkant vers `/`
- Chaque label nav de `config.header.nav` apparaît dans le header
- Footer visible avec copyright de `config.footer.copyright`
- Menu mobile toggle visible à 375px

### i18n (`i18n.spec.ts`)

- Page home charge avec le contenu en langue par défaut (hero headline)
- Si `langSwitch` activé dans config : switch de langue change le texte visible

## Ce qui reste hardcodé et pourquoi

| Route/donnée | Pourquoi hardcodé | Source |
|--------------|-------------------|--------|
| `/profil/:slug` | Défini dans le code du module, pas dans `config.pages` | `src/modules/profil/routes.tsx` |
| `/page-inexistante` | Route intentionnellement invalide pour tester le 404 fallback | Convention de test |
| `"/"` | Route structurelle, toujours présente | Convention de toute app web |
| Tabs de profil | Le type d'entité est résolu par l'API, pas par la config | Backend-dependent |
| Tabs conditionnels (`social`, `membership`) | Dépendent de `condition.userContext: "own"` | Runtime user context |

## Variables d'environnement de test

| Variable | Usage | Fichier |
|----------|-------|---------|
| `TEST_USER_EMAIL` | Email pour tests auth backend réel | `.env.test` |
| `TEST_USER_PASSWORD` | Password pour tests auth backend réel | `.env.test` |
| `VITE_BASE_URL_BACKEND` | URL backend (défaut: `http://localhost:5080`) | `.env` / process.env |
| `VITE_SLUG` | Slug profil pour tests E2E (défaut: `franceTierslieux`) | `.env` / process.env |
| `SITE_CONFIG_PATH` | Chemin config JSON (défaut: `./config.prod.json`) | `.env` / process.env |
| `STRICT_SSR_MARKERS` | `=1` pour activer les checks Suspense markers dans `ssr-completeness.test.ts` (serveur prod requis) | process.env |
| `DEBUG_SERVER` | `=1` pour activer les logs d'erreur du serveur d'intégration dans `global-setup.ts` | process.env |

> **Ne jamais committer `.env.test`** qui contient des credentials. Ce fichier est dans `.gitignore`.

## Guide : Ajouter un nouveau test config-driven

**1. Identifier la source dans la config**

Déterminer quelle donnée de `config.prod.json` pilote le test : une page, un type de section, un item nav, un profil...

**2. Ajouter une fonction helper si nécessaire**

Si le pattern de recherche est réutilisable, l'ajouter dans `e2e/helpers/config.ts` :

```ts
export function findPagesWithSection(config: SiteConfig, type: string): SitePage[] {
  return config.pages.filter((p) => p.sections.some((s) => s.type === type));
}
```

**3. Utiliser dans le spec**

```ts
import { loadSiteConfig, findPagesWithSection } from "./helpers/config";

const config = loadSiteConfig();
const galleryPages = findPagesWithSection(config, "gallery");

test.describe("Gallery", () => {
  for (const page of galleryPages) {
    test(`${page.path} renders gallery`, async ({ page: pw }) => {
      await pw.goto(page.path);
      // assertions...
    });
  }
});
```

**4. Pour les tests d'intégration SSR**

Charger la config directement avec `fs.readFileSync` (pas d'import du helper E2E) :

```ts
import fs from "node:fs";
import path from "node:path";

const config = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../../config.prod.json"), "utf-8")
);
```

**5. Principe de fallback**

Toujours prévoir un fallback gracieux si la config ne contient pas la donnée attendue :

```ts
const loginPath = findLoginPath(config);
if (!loginPath) {
  // Fallback: cliquer "Se connecter" depuis "/"
  // Ou: test.skip() si le test n'a pas de sens sans login page
}
```

---

## Voir aussi

- [Configuration](02-configuration.md)
- [Architecture](03-architecture.md)
- [Déploiement Docker](16-deploiement-docker.md)
