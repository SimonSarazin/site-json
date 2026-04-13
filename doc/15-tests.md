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
    - [Tests de concurrence SSR (`ssr-concurrency.test.ts`)](#tests-de-concurrence-ssr-ssr-concurrencytestts)
  - [Tests unitaires](#tests-unitaires)
    - [ImageOptimizer (`server/__tests__/imageOptimizer.test.ts`)](#imageoptimizer-server__tests__imageoptimizertestts)
    - [Sanitize (`src/lib/__tests__/sanitize.test.ts`)](#sanitize-srclib__tests__sanitizetestts)
    - [Permissions (`src/lib/__tests__/permissions.test.ts`)](#permissions-srclib__tests__permissionstestts)
    - [Validation configs multi-sites (`tests/preflight/sites-configs.test.ts`)](#validation-configs-multi-sites-testspreflightsites-configstestts)
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
| **Unit** | Vitest | Logique pure, fonctions utilitaires, sécurité (sanitize, permissions, imageOptimizer) | < 1s |
| **Preflight** | Vitest | Validation env, configs JSON, schéma Zod, toutes les configs de `sites.json` | < 1s |
| **Integration SSR** | Vitest | Rendu serveur, concurrence, hydratation state | ~20s |
| **E2E** | Playwright | Navigation browser, formulaires, hydratation client | ~2min |

## Commandes de test

| Commande | Description |
|----------|-------------|
| `npm run test:unit` | Tests unitaires + preflight (Vitest) |
| `npm run test:integration` | Tests d'intégration SSR avec serveur dédié (Vitest) |
| `npm run test:e2e` | Tests end-to-end navigateur (Playwright) |
| `npm run test:all` | Exécute les trois niveaux séquentiellement |
| `npm run test:preflight` | Vérification rapide de l'environnement |

Pour les tests E2E avec authentification backend réelle :

```bash
source .env.test && npm run test:e2e
```

## Arborescence des fichiers de test

```
.
├── src/lib/__tests__/
│   ├── apiClient.test.ts        # Singleton API client, isolation server/client
│   ├── configValidation.test.ts # Validation schéma Zod
│   ├── sanitize.test.ts         # Tests XSS (scripts, event handlers, iframes)
│   └── permissions.test.ts      # Registre permissions (register, get, overwrite)
├── server/__tests__/
│   └── imageOptimizer.test.ts   # Fonctions pures (allowlist, format, magic bytes, MIME)
├── tests/
│   ├── preflight/
│   │   ├── environment.test.ts  # Vérification Node, deps, fichiers config
│   │   └── sites-configs.test.ts # Validation de TOUTES les configs de sites.json
│   ├── helpers/
│   │   ├── global-setup.ts      # Démarre le serveur SSR sur port 5188
│   │   └── server-manager.ts    # Expose getBaseUrl() pour les tests intégration
│   └── integration/
│       ├── config-driven-ssr.test.ts  # SSR par page config, meta, nav, sections
│       ├── ssr-rendering.test.ts      # SSR home + pages secondaires + 404
│       └── ssr-concurrency.test.ts    # 10-20 requêtes parallèles, cross-route leakage
├── e2e/
│   ├── global-setup.ts          # Warmup du dev server Playwright
│   ├── helpers/
│   │   └── config.ts            # Helper partagé config-driven (loadSiteConfig, etc.)
│   ├── hydration.spec.ts        # SSR sans JS, hydratation, window globals
│   ├── search.spec.ts           # Sections searchPro/searchProStatic/gridLayout
│   ├── auth-flow.spec.ts        # Auth avec mocks API (login/logout flow)
│   ├── auth-real.spec.ts        # Auth avec vrai backend (skip si pas de credentials)
│   ├── profile.spec.ts          # Pages profil + validation config.profiles
│   ├── config-nav.spec.ts       # Header nav, footer, logo (config-driven)
│   └── i18n.spec.ts             # Langue par défaut, switch de langue
├── vitest.config.unit.ts        # Config Vitest pour unit + preflight + server
├── vitest.config.integration.ts # Config Vitest pour intégration (globalSetup, timeout 60s)
└── playwright.config.ts         # Config Playwright (chromium, webServer dev)
```

## Configuration Vitest

**`vitest.config.unit.ts`** : Tests unitaires rapides.

```ts
test: {
  environment: "node",
  include: ["src/**/*.test.ts", "tests/preflight/**/*.test.ts", "server/**/*.test.ts"],
}
```

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

Les tests d'authentification utilisent un helper commun `navigateToLoginForm()` qui implémente une stratégie à deux niveaux :

1. **Page login config** : Si `findLoginPath(config)` retourne un chemin, naviguer vers cette page
2. **Fallback header** : Si pas de page login ou pas de formulaire visible, naviguer vers `/` et cliquer le bouton "Se connecter" dans le header

```ts
async function navigateToLoginForm(page: Page): Promise<boolean> {
  // Stratégie 1 : page login depuis config
  if (loginPath) {
    await page.goto(loginPath);
    const emailInput = page.locator('input[type="email"]').first();
    if ((await emailInput.count()) > 0) return true;
  }

  // Stratégie 2 : fallback via header
  await page.goto("/");
  const loginButton = page.getByRole("button", { name: /Se connecter/i });
  if ((await loginButton.count()) > 0) {
    await loginButton.first().click();
    return true;
  }

  return false;  // Aucun formulaire login trouvé → test.skip()
}
```

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

### Tests de concurrence SSR (`ssr-concurrency.test.ts`)

Stress-test du pipeline SSR streaming :
- 1 requête : vérifie les globals et `#root`
- 10 requêtes parallèles sur `/` : toutes 200 avec state parseable
- 20 requêtes parallèles sur routes mixtes (config + fallback) : pas de troncature
- 5 requêtes parallèles : state déshydraté contient `cocolight-data` query
- Cross-route leakage : `/` et page secondaire en parallèle ne mélangent pas leur contenu

## Tests unitaires

### ImageOptimizer (`server/__tests__/imageOptimizer.test.ts`)

Teste les 5 fonctions pures exportées du middleware d'optimisation d'images (37 tests) :

- **`buildAllowlist()`** : construction de la whitelist de domaines depuis les variables d'environnement (localhost par défaut, `VITE_BASE_URL_BACKEND`, `IMAGE_OPTIMIZER_ALLOWED_DOMAINS`)
- **`isDomainAllowed()`** : vérification qu'une URL distante est dans la whitelist (sécurité SSRF)
- **`negotiateFormat()`** : négociation du format de sortie via le header Accept (AVIF > WebP > JPEG)
- **`detectImageType()`** : détection du vrai type d'image par magic bytes (PNG, JPEG, WebP, GIF, TIFF, AVIF). Retourne `null` pour du HTML ou des buffers invalides.
- **`mimeFromPath()`** : déduction du type MIME depuis l'extension de fichier

### Sanitize (`src/lib/__tests__/sanitize.test.ts`)

Teste la fonction `sanitize()` contre les vecteurs XSS classiques (16 tests) :

- Suppression des `<script>`, `<iframe>`, `<object>`
- Suppression des event handlers (`onclick`, `onerror`, `onload`, `onmouseover`)
- Suppression des `javascript:` URI dans les href
- Préservation du HTML safe (`<p>`, `<strong>`, `<a href>`)
- Payloads XSS : `<img src=x onerror=alert(1)>`, `<svg onload=alert(1)>`, etc.

### Permissions (`src/lib/__tests__/permissions.test.ts`)

Teste le registre central des calculateurs de permissions (10 tests) :

- `registerPermissions()` + `getCalculator()` : enregistrement et récupération
- `hasCalculator()` : existence d'un namespace
- `getAllCalculators()` : liste complète
- Overwrite : ré-enregistrement du même namespace → `console.warn` + remplacement
- Namespace inconnu → `undefined`
- `_resetForTesting()` : nettoyage entre les tests
- Le contexte (`entity`, `me`, `data`) est bien passé au calculateur

### Validation configs multi-sites (`tests/preflight/sites-configs.test.ts`)

Valide automatiquement **toutes** les configs référencées dans `sites.json` (56 tests) :

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
