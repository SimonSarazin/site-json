
- [1. Introduction générale](#1-introduction-générale)
  - [1.1 Présentation du projet](#11-présentation-du-projet)
  - [1.2 Objectifs](#12-objectifs)
  - [1.3 Structure d’ensemble du repository](#13-structure-densemble-du-repository)
- [2. Installation et démarrage](#2-installation-et-démarrage)
  - [2.1 Prérequis](#21-prérequis)
  - [2.2 Clonage du dépôt](#22-clonage-du-dépôt)
  - [2.3 Installation des dépendances](#23-installation-des-dépendances)
  - [2.4 Configuration des variables d’environnement](#24-configuration-des-variables-denvironnement)
  - [2.5 Commandes principales](#25-commandes-principales)
- [3. Configuration](#3-configuration)
  - [3.1 Variables d’environnement](#31-variables-denvironnement)
  - [3.2 Fichiers JSON de configuration](#32-fichiers-json-de-configuration)
    - [`config.prod.json`](#configprodjson)
  - [3.3 Fichier de configuration Vite (`vite.config.ts`)](#33-fichier-de-configuration-vite-viteconfigts)
- [4. Architecture du projet](#4-architecture-du-projet)
  - [4.1 Arborescence des dossiers](#41-arborescence-des-dossiers)
  - [4.2 Flux d’exécution](#42-flux-dexécution)
  - [4.3 Injection de la configuration et des ENV](#43-injection-de-la-configuration-et-des-env)
- [5. Documentation exhaustive du schéma JSON (`SiteConfigSchema`)](#5-documentation-exhaustive-du-schéma-json-siteconfigschema)
  - [5.1 Propriétés racine](#51-propriétés-racine)
  - [5.2 `MetaSchema`](#52-metaschema)
  - [5.3 `HeaderSchema`](#53-headerschema)
    - [5.3.1 `NavItemSchema`](#531-navitemschema)
    - [5.3.2 Utilitaires](#532-utilitaires)
  - [5.4 `PageSchema`](#54-pageschema)
    - [5.4.1 `SeoSchema`](#541-seoschema)
  - [5.5 Sections (`SectionSchemaUnion`) — Schémas complets](#55-sections-sectionschemaunion--schémas-complets)
    - [5.5.1 `hero`](#551-hero)
    - [5.5.2 `cards`](#552-cards)
    - [5.5.3 `stats`](#553-stats)
    - [5.5.4 `logoCloud`](#554-logocloud)
    - [5.5.5 `testimonials`](#555-testimonials)
    - [5.5.6 `pricing`](#556-pricing)
    - [5.5.7 `faq`](#557-faq)
    - [5.5.8 `cta`](#558-cta)
    - [5.5.9 `blogList`](#559-bloglist)
    - [5.5.10 `contactForm`](#5510-contactform)
    - [5.5.11 `registerForm`, `loginForm`, `recoverPasswordForm`](#5511-registerform-loginform-recoverpasswordform)
    - [5.5.12 `markdown`](#5512-markdown)
    - [5.5.13 `gallery`](#5513-gallery)
    - [5.5.14 `video`](#5514-video)
    - [5.5.15 `table`](#5515-table)
    - [5.5.16 `chart`](#5516-chart)
    - [5.5.17 `map`](#5517-map)
    - [5.5.18 `newsletter`](#5518-newsletter)
    - [5.5.19 `comparison`](#5519-comparison)
    - [5.5.20 `featureComparison`](#5520-featurecomparison)
    - [5.5.21 `socialFeed`](#5521-socialfeed)
    - [5.5.22 `search` (déprécié)](#5522-search)
    - [5.5.23 `eventList`](#5523-eventlist)
    - [5.5.24 `productShowcase`](#5524-productshowcase)
    - [5.5.25 `cookieConsent`](#5525-cookieconsent)
    - [5.5.26 `html`](#5526-html)
    - [5.5.27 `banner`](#5527-banner)
    - [5.5.28 `breadcrumb`](#5528-breadcrumb)
    - [5.5.29 `tabs`](#5529-tabs)
    - [5.5.30 `steps`](#5530-steps)
    - [5.5.31 `team`](#5531-team)
    - [5.5.32 `timeline`](#5532-timeline)
    - [5.5.33 `blogPost`](#5533-blogpost)
    - [5.5.34 `searchPro`](#5534-searchpro)
  - [5.6 `FooterSchema`](#56-footerschema)
  - [5.7 `IntegrationsSchema`](#57-integrationsschema)
  - [5.8 `FeatureFlagSchema`](#58-featureflagschema)
  - [5.9 `ThemeConfigSchema`](#59-themeconfigschema)
  - [5.10 `PerformanceConfigSchema`](#510-performanceconfigschema)
  - [5.11 `AdvancedSiteConfig`](#511-advancedsiteconfig)
- [6. Sections dynamiques](#6-sections-dynamiques)
  - [6.1 Vue d’ensemble de `SectionRenderer.tsx`](#61-vue-densemble-de-sectionrenderertsx)
    - [Extrait simplifié](#extrait-simplifié)
  - [6.2 Propriétés communes à toutes les sections](#62-propriétés-communes-à-toutes-les-sections)
  - [6.3 Description rapide des principaux types de section](#63-description-rapide-des-principaux-types-de-section)
  - [6.4 Comment ajouter ou personnaliser une nouvelle section](#64-comment-ajouter-ou-personnaliser-une-nouvelle-section)
- [7. Modules fonctionnels](#7-modules-fonctionnels)
  - [7.1 Module Search (`src/modules/search`)](#71-module-search-srcmodulessearch)
    - [7.1.1 Architecture interne](#711-architecture-interne)
    - [7.1.2 Schéma de configuration (`schema.ts`)](#712-schéma-de-configuration-schemats)
    - [7.1.3 Context et hooks](#713-context-et-hooks)
    - [7.1.4 Composants clés](#714-composants-clés)
    - [7.1.5 Exemple de configuration JSON](#715-exemple-de-configuration-json)
  - [7.2 Autres modules à faire et documenter](#72-autres-modules-à-faire-et-documenter)
- [8. API Client \& Authentification](#8-api-client--authentification)
  - [8.1 Initialisation de l’API (`apiClient.ts`)](#81-initialisation-de-lapi-apiclientts)
  - [8.2 Stratégies de stockage des tokens](#82-stratégies-de-stockage-des-tokens)
    - [8.2.1 MultiServerTokenStorageStrategy](#821-multiservertokenstoragestrategy)
    - [8.2.2 MemoryStorageStrategy](#822-memorystoragestrategy)
  - [8.3 Contexte React (`CocolightContext`)](#83-contexte-react-cocolightcontext)
  - [8.4 Hooks d’accès au client](#84-hooks-daccès-au-client)
    - [8.4.1 `useCocolight`](#841-usecocolight)
    - [8.4.2 `useCocolightInit`](#842-usecocolightinit)
  - [8.5 Flux d’authentification](#85-flux-dauthentification)
  - [8.6 Exemple d’intégration](#86-exemple-dintégration)
- [9. Sécurité et validation](#9-sécurité-et-validation)
  - [9.1 Validation des schémas JSON (Zod)](#91-validation-des-schémas-json-zod)
  - [9.2 Sanitisation du contenu (DOMPurify)](#92-sanitisation-du-contenu-dompurify)
- [10. Performance et optimisation](#10-performance-et-optimisation)
  - [10.1 Lazy loading des sections et des images](#101-lazy-loading-des-sections-et-des-images)
    - [10.1.1 Chargement asynchrone des sections](#1011-chargement-asynchrone-des-sections)
    - [10.1.2 Lazy loading des images](#1012-lazy-loading-des-images)
  - [10.2 Code splitting et bundling](#102-code-splitting-et-bundling)
  - [10.3 Optimisation des images](#103-optimisation-des-images)
  - [10.4 Caching et hydratation des données](#104-caching-et-hydratation-des-données)
  - [10.5 Compression et réseau](#105-compression-et-réseau)
- [11. Internationalisation (i18n)](#11-internationalisation-i18n)
  - [11.1 `LocalizedString` dans la configuration](#111-localizedstring-dans-la-configuration)
  - [11.2 Contexte de localisation](#112-contexte-de-localisation)
    - [11.2.1 Définition du contexte](#1121-définition-du-contexte)
    - [11.2.2 Provider](#1122-provider)
  - [11.3 Hook `useT`](#113-hook-uset)
  - [11.4 Exemple d’utilisation](#114-exemple-dutilisation)
    - [11.5 Cas particuliers : modules et composants hors configuration JSON](#115-cas-particuliers--modules-et-composants-hors-configuration-json)
      - [11.5.1 Chargement dynamique d’un namespace](#1151-chargement-dynamique-dun-namespace)
      - [11.5.2 Organisation des fichiers i18n](#1152-organisation-des-fichiers-i18n)
      - [11.5.3 Implémentation des hooks](#1153-implémentation-des-hooks)
- [12. Backend et SSR](#12-backend-et-ssr)
  - [12.1 `server/dev-server.js` ](#121-serverdev-serverjs-)
  - [12.2 `server/prod-server.js` ](#122-serverprod-serverjs-)
  - [12.3 `src/entry-server.tsx` ](#123-srcentry-servertsx-)
  - [12.4 `src/entry-client.tsx` ](#124-srcentry-clienttsx-)


## 1. Introduction générale

### 1.1 Présentation du projet

SiteForge est un générateur de sites web piloté par un simple fichier JSON. Son objectif est de démocratiser la création de sites statiques ou SSR sans écrire une seule ligne de HTML/CSS/JS, tout en offrant :

* **Modularité** : chaque partie du site (header, sections, footer…) est un composant React réutilisable.
* **Performance** : lazy loading, code splitting, optimisation d’images, SSR streaming.
* **Extensibilité** : on peut ajouter de nouveaux types de sections ou modules (ex. recherche, formulaires).
* **Internationalisation** : prise en charge native de plusieurs langues via Zod, JSON et hooks de traduction.
* **Sécurité** : validation des schémas JSON (Zod), sanitisation du contenu (DOMPurify) et bonnes pratiques serveur.

### 1.2 Objectifs

* Permettre à des non-développeurs de configurer un site professionnel uniquement via JSON.
* Offrir aux développeurs un cadre flexible pour étendre ou personnaliser chaque composant.
* Garantir un rendu rapide et optimisé, côté client et côté serveur (SSR).

### 1.3 Structure d’ensemble du repository

```
.
├── scripts/               # Génération de fichiers de config automatisée
├── server/                # Serveurs Express pour dev (middleware Vite) et prod (SSR)
│   ├── dev-server.js      # Serveur de développement avec Vite en middleware
│   └── prod-server.js     # Serveur de production, compression & rendu SSR
├── src/                   # Code source principal
│   ├── components/        # Composants React UI (layout/, sections/, ui/)
│   ├── contexts/          # Providers React (Cocolight, i18n, SiteContext…)
│   ├── data/              # Exemples de configuration (demo-site.ts)
│   ├── helpers/           # Fonctions utilitaires (email, date…)
│   ├── hooks/             # Hooks React personnalisés (useToast, useCocolight…)
│   ├── lib/               # API client, routes dynamiques, utils génériques
│   ├── modules/           # Modules fonctionnels (search, events…)
│   ├── types/             # Schémas Zod & types TypeScript (site-schema, locale-schema…)
│   ├── entry-client.tsx   # Point d’entrée client pour le bundler Vite
│   ├── entry-server.tsx   # Point d’entrée SSR pour la génération de HTML
│   └── RootLayout.tsx     # Layout racine avec tous les providers et l’Outlet React Router
├── .gitignore             # Fichiers ignorés par Git
├── config.prod.json       # Configuration JSON de production (meta, header, pages…)
├── package.json           # Dépendances, scripts et résolutions de versions
├── tsconfig*.json         # Configurations TypeScript
└── vite.config.ts         # Configuration du bundler Vite (alias, plugins, SSR)
```

Chaque dossier et fichier principal sera détaillé dans les sections suivantes de la documentation.

---

## 2. Installation et démarrage

### 2.1 Prérequis

* **Node.js** ≥ 18.x (LTS)
* **npm** ≥ 9.x ou **Yarn** ≥ 1.x
* **Git** (pour cloner le dépôt)
* Un éditeur de code (VS Code recommandé)

> **Optionnel** :
>
> * **Docker** si vous souhaitez containeriser l’application
> * **Make** ou équivalent pour automatiser les tâches

---

### 2.2 Clonage du dépôt

```bash
git clone <URL_DU_REPOSITORY>
cd <NOM_DU_REPOSITORY>
```

---

### 2.3 Installation des dépendances

Selon votre gestionnaire de paquets :

* **npm**

  ```bash
  npm install
  ```

* **Yarn**

  ```bash
  yarn install
  ```

---

### 2.4 Configuration des variables d’environnement

Créez un fichier `.env` à la racine du projet (voir section 3 pour le détail des variables) :

```dotenv
# Mode d’exécution
NODE_ENV=development

# Port de développement
PORT=5173

# Fichiers de configuration du site
# En développement, on peut charger directement le fichier JSON
SITE_CONFIG_PATH=./config.prod.json

# Variables coté client (préfixées VITE_)
VITE_BASE_URL_BACKEND=http://localhost:3000
VITE_SERVER_URL=http://localhost:3000
VITE_SLUG=default
```

---

### 2.5 Commandes principales

| Commande                           | Description                                                     |
| ---------------------------------- | --------------------------------------------------------------- |
| `npm run dev` / `yarn dev`         | Démarrage du serveur de développement (Vite + SSR)              |
| `npm run build` / `yarn build`     | Compilation client (`build:client`) et serveur (`build:server`) |
| `npm run preview` / `yarn preview` | Prévisualisation du build de production (port 3000)             |
| `npm run start` / `yarn start`     | Lancement du serveur de production (Express SSR)                |
| `npm run lint` / `yarn lint`       | Exécution d’ESLint pour vérifier la qualité du code             |

> **Remarque** :
>
> * En mode **dev**, Vite fournit le HMR et le middleware SSR.
> * En mode **build** puis **preview**, le client est servi depuis `dist/client` et le SSR depuis `dist/server`.

---

## 3. Configuration

La configuration de SiteForge se fait principalement via :

1. **Variables d’environnement**
2. **Fichiers JSON de configuration**
3. **Fichier de configuration Vite**

---

### 3.1 Variables d’environnement

| Variable                | Description                                                                                | Valeur par défaut              |
| ----------------------- | ------------------------------------------------------------------------------------------ | ------------------------------ |
| `SITE_CONFIG_JSON`      | JSON complet de la configuration du site. Si présent, il est parsé directement.            | —                              |
| `SITE_CONFIG_PATH`      | Chemin vers un fichier JSON contenant la configuration du site.                            | —                              |
| `VITE_BASE_URL_BACKEND` | URL de base pour les appels API depuis le client (injectée en tant que `import.meta.env`). | `http://localhost:3000`        |
| `VITE_SERVER_URL`       | URL publique du serveur (injectée en tant que `import.meta.env`).                          | `http://localhost:3000`        |
| `VITE_SLUG`             | « Slug » à utiliser pour les requêtes par défaut (injecté en tant que `import.meta.env`).  | `default`                      |
| `NODE_ENV`              | Mode d’exécution Node.js (`development` ou `production`).                                  | Défini par Vite ou `npm run …` |
| `PORT`                  | Port sur lequel le serveur écoute en mode dev ou preview.                                  | `5173` en dev, `3000` en prod  |

> **En production**, au moins `SITE_CONFIG_JSON` **ou** `SITE_CONFIG_PATH` doit être défini — sinon le serveur arrête le démarrage avec une erreur.

La fonction utilitaire `readEnv` centralise la lecture :

```ts
function readEnv<K extends keyof RuntimeEnv>(
  key: K, fallback: string
): string {
  const value =
    (typeof window !== 'undefined' ? window.__ENV__?.[key] : undefined) ??
    (typeof process !== 'undefined' ? process.env?.[key] : undefined) ??
    (typeof import.meta !== 'undefined' ? (import.meta.env as any)?.[key] : undefined);
  return typeof value === 'string' && value.length ? value : fallback;
}
```

---

### 3.2 Fichiers JSON de configuration

#### `config.prod.json`

Ce fichier contient la structure complète du site :

* Métadonnées (titre, description, langues, favicon…)
* Configuration du header (menus, utilities, logo…)
* Pages et sections (hero, cards, pricing, blog, about, showcase…)

Extrait :

```json
{
  "meta": {
    "title": { "fr": "SiteForge", "en": "SiteForge" },
    "description": { "fr": "Générateur JSON", "en": "JSON Site Generator" }
  },
  "header": {
    "nav": [ /* … */ ],
    "utilities": { "themeSwitch": true, "auth": true }
  },
  "pages": [
    {
      "path": "/",
      "title": { "fr": "Accueil", "en": "Home" },
      "sections": [
        {
          "type": "hero",
          "props": {
            "headline": { "fr": "Bienvenue", "en": "Welcome" },
            "cta": [ /* … */ ]
          }
        },
        /* … */
      ]
    },
    /* … */
  ]
}
```

* En **développement**, on peut charger ce fichier localement grâce à `SITE_CONFIG_PATH=./config.prod.json`.
* En **production**, on peut choisir `SITE_CONFIG_JSON` pour passer tout le contenu via une variable.

---

### 3.3 Fichier de configuration Vite (`vite.config.ts`)

Vite est configuré pour supporter :

* **Alias** : `@` → `./src`
* **Plugins** : React, TailwindCSS
* **Définition d’environnements** :

  ```ts
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
  }
  ```
* **SSR** : entrée `src/entry-server.tsx`, exclusion de certains modules
* **Optimisations** : exclusion de `lucide-react` en dev, rollupOptions pour SSR

Extrait :

```ts
export default defineConfig(({ mode, isSsrBuild }) => ({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  define: { 'process.env.NODE_ENV': JSON.stringify(mode) },
  ssr: {
    noExternal: ['@radix-ui/', 'lucide-react'],
    external: ['express', 'compression', '@communecter/cocolight-api-client']
  },
  build: isSsrBuild ? { rollupOptions: { /* … */ } } : undefined
}))
```

---

## 4. Architecture du projet

Cette section décrit l’organisation générale du code, le flux d’exécution et la façon dont la configuration et les variables d’environnement sont injectées, que ce soit côté client ou lors du rendu SSR.

---

### 4.1 Arborescence des dossiers

```
.
├── .bolt/                 # Scripts et configurations d’alerte/ignore interne
├── scripts/               # Outils de génération automatique (ex. génération de config)
├── server/                # Serveurs Express (dev et prod)
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
│   ├── lib/               # Bibliothèques internes (apiClient, buildRoutes, sanitize)
│   ├── modules/           # Modules fonctionnels (search, events, contactForm…)
│   ├── types/             # Schémas Zod & types TS (site-schema, locale-schema…)
│   ├── entry-client.tsx   # Point d’entrée bundler client (hydrate React)
│   ├── entry-server.tsx   # Point d’entrée SSR (renderToPipeableStream)
│   └── RootLayout.tsx     # Layout global avec providers et React Router Outlet
├── config.prod.json       # Configuration JSON structurée du site
├── package.json           # Dépendances, scripts, résolutions
├── tsconfig*.json         # Config TypeScript
└── vite.config.ts         # Configuration Vite (alias, plugins, SSR, define)
```

---

### 4.2 Flux d’exécution

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
   * React hydrate ensuite l’application via `entry-client.tsx`, utilisant les providers définis dans `RootLayout`.

---

### 4.3 Injection de la configuration et des ENV

* **Configuration JSON**
  Le serveur SSR injecte la config du site sous forme d’un script inline :

  ```html
  <script>
    window.__CONFIG__ = { /* contenu de SITE_CONFIG_JSON ou du fichier SITE_CONFIG_PATH */ };
  </script>
  ```

* **Variables d’environnement**
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
  Côté client et SSR, la fonction `readEnv` cherche d’abord `window.__ENV__`, puis `process.env`, puis `import.meta.env`, assurant une cohérence entre développement et production.

---

## 5. Documentation exhaustive du schéma JSON (`SiteConfigSchema`)

Ci-dessous la description complète de chaque propriété du schéma global **`SiteConfigSchema`**, ainsi que de tous les types de sections supportés, basée sur la structure et les exemples de `config.prod.json`.

---

### 5.1 Propriétés racine

```ts
SiteConfigSchema = z.object({
  meta: MetaSchema,
  header: HeaderSchema,
  pages: z.array(PageSchema),
});
```

| Propriété  | Type           | Description                                                       |
| ---------- | -------------- | ----------------------------------------------------------------- |
| **meta**   | `MetaSchema`   | Métadonnées globales du site                                      |
| **header** | `HeaderSchema` | Configuration de l’en-tête (logo, menu, utilitaires)              |
| **pages**  | `PageSchema[]` | Liste des pages du site avec leur configuration et leurs sections |

---

### 5.2 `MetaSchema`

```ts
MetaSchema = z.object({
  title: LocalizedString,
  description: LocalizedString,
  defaultLang: z.enum(LOCALES),
  languages: z.array(z.enum(LOCALES)).min(1),
  favicon: z.string().url(),
  themeColor: z.string().optional()
})
```

| Clé           | Type                            | Exigé ? | Exemple                         | Description                               |
| ------------- | ------------------------------- | ------- | ------------------------------- | ----------------------------------------- |
| `title`       | `{ fr: string; en: string; … }` | Oui     | `{ fr: "Accueil", en: "Home" }` | Titre multi-langues de la page ou du site |
| `description` | `LocalizedString`               | Oui     | `{ fr: "...", en: "..." }`      | Description multi-langues                 |
| `defaultLang` | `"fr" \| "en"`                  | Oui     | `"fr"`                          | Langue par défaut                         |
| `languages`   | `("fr" \| "en")[]`              | Oui     | `["fr","en"]`                   | Langues supportées                        |
| `favicon`     | `string (URL)`                  | Oui     | `"/favicon.ico"`                | Chemin ou URL de l’icône                  |
| `themeColor`  | `string`                        | Non     | `"#3b82f6"`                     | Couleur principale (meta `<theme-color>`) |

---

### 5.3 `HeaderSchema`

```ts
HeaderSchema = z.object({
  logo: z.string().optional(),
  logoAlt: LocalizedString.optional(),
  nav: z.array(NavItemSchema).default([]),
  utilities: z.object({ themeSwitch, langSwitch, search, auth, cart, notifications }).partial(),
  sticky: z.boolean().default(false),
  transparent: z.boolean().default(false),
  height: z.string().optional()
})
```

#### 5.3.1 `NavItemSchema`

```ts
NavItemSchema = z.object({
  path?: string,
  href?: string,
  label: LocalizedString,
  icon?: string,
  children?: NavItemSchema[],
  badge?: { text: LocalizedString; color: string }
})
```

| Clé        | Type                                       | Exigé ? | Description                   |
| ---------- | ------------------------------------------ | ------- | ----------------------------- |
| `path`     | `string`                                   | Non     | Route interne (`"/about"`)    |
| `href`     | `string`                                   | Non     | Lien absolu externe           |
| `label`    | `LocalizedString`                          | Oui     | Texte du menu multi-langues   |
| `icon`     | `string`                                   | Non     | Nom d’icône (lucide, etc.)    |
| `children` | `NavItemSchema[]`                          | Non     | Sous-menus récursifs          |
| `badge`    | `{ text: LocalizedString; color: string }` | Non     | Badge associé (ex. “Nouveau”) |

#### 5.3.2 Utilitaires

| Clé             | Type      | Default | Description                    |
| --------------- | --------- | ------- | ------------------------------ |
| `themeSwitch`   | `boolean` | `false` | Affiche le switch dark/light   |
| `langSwitch`    | `boolean` | `false` | Affiche le sélecteur de langue |
| `search`        | `boolean` | `false` | Affiche l’icône recherche      |
| `auth`          | `boolean` | `false` | Affiche l’authentification     |
| `cart`          | `boolean` | `false` | Affiche le panier              |
| `notifications` | `boolean` | `false` | Affiche les notifications      |

---

### 5.4 `PageSchema`

```ts
PageSchema = z.object({
  path: string,
  title: LocalizedString,
  seo?: SeoSchema,
  layout?: string,
  hideHeader: z.boolean().default(false),
  hideFooter: z.boolean().default(false),
  sections: z.array(SectionSchemaUnion),
  auth?: z.object({
    required: z.boolean().default(false),
    roles?: z.array(z.string()),
  middleware?: z.array(z.string()),
  customCSS?: z.string(),
  customJS?: z.string()
})
```

* **auth**

  * `required` : si la page nécessite une authentification.
  * `roles` : liste des rôles autorisés.

* **middleware**

  * Tableau de noms de fonctions middleware à exécuter avant rendu.

* **hideHeader**, **hideFooter**

  * Masquer l’en-tête ou le pied de page sur cette route.

* **customCSS**, **customJS**

  * Chemin ou code inline pour charger du CSS/JS additionnel par page.

#### 5.4.1 `SeoSchema`

```ts
SeoSchema = z.object({
  title: LocalizedString,
  description: LocalizedString,
  ogImage?: string,
  ogType?: string,
  twitterCard?: string,
  keywords?: string[],
  structuredData?: any
})
```

| Clé                    | Type              | Description                                   |
| ---------------------- | ----------------- | --------------------------------------------- |
| `title`, `description` | `LocalizedString` | Meta `<title>` et `<meta name="description">` |
| `ogImage`              | `string (URL)`    | OpenGraph image                               |
| `ogType`               | `string`          | Type OG (`website`, `article`…)               |
| `twitterCard`          | `string`          | `summary_large_image` etc.                    |
| `keywords`             | `string[]`        | Mots-clés SEO                                 |
| `structuredData`       | `any`             | JSON-LD (Schema.org)                          |

---

### 5.5 Sections (`SectionSchemaUnion`) — Schémas complets

Chaque section est un objet :

```ts
SectionSchema = z.object({ type: z.literal(<SECTION_TYPE>), id?: string, props: <PropsSchema> })
```

#### 5.5.1 `hero`

```ts
export const HeroSectionSchema = z.object({
  type: z.literal("hero"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,                // titre principal (multi-langue)
    subhead: LocalizedString.optional(),      // sous-titre
    backgroundImage: z.string().url().optional(),
    videoBg: z.string().optional(),
    overlay: z.boolean().default(false),
    align: z.enum(["left","center","right"]).default("center"),
    cta: z.array(z.object({
      label: LocalizedString,                 // texte bouton
      href: z.string(),                       // lien
      variant: z.string().optional()          // style (ex. "primary")
    })).optional(),
    scrollTo: z.string().optional()           // ancre pour scroll
  })
});
```

#### 5.5.2 `cards`

```ts
export const CardsSectionSchema = z.object({
  type: z.literal("cards"),
  id: z.string().optional(),
  props: z.object({
    columns: z.number().int().min(1).max(6),
    layout: z.enum(["grid","stack"]).default("grid"),
    items: z.array(z.object({
      icon: z.string(),                       // nom d’icône
      title: LocalizedString,
      text: LocalizedString
    }))
  })
});
```

#### 5.5.3 `stats`

```ts
export const StatsSectionSchema = z.object({
  type: z.literal("stats"),
  id: z.string().optional(),
  props: z.object({
    items: z.array(z.object({
      value: z.string(),                      // ex. "10,000+"
      label: LocalizedString,
      description: LocalizedString,
      icon: z.string()
    })),
    layout: z.enum(["horizontal","vertical"]).default("horizontal"),
    animated: z.boolean().default(false)
  })
});
```

#### 5.5.4 `logoCloud`

```ts
export const LogoCloudSectionSchema = z.object({
  type: z.literal("logoCloud"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString.optional(),
    logos: z.array(z.object({
      src: z.string().url(),
      alt: LocalizedString
    })),
    grayscale: z.boolean().default(false),
    animated: z.boolean().default(false)
  })
});
```

#### 5.5.5 `testimonials`

```ts
export const TestimonialsSectionSchema = z.object({
  type: z.literal("testimonials"),
  id: z.string().optional(),
  props: z.object({
    style: z.enum(["carousel","grid"]).default("carousel"),
    autoplay: z.boolean().default(false),
    items: z.array(z.object({
      quote: LocalizedString,
      author: LocalizedString,
      role: LocalizedString,
      avatar: z.string().url()
    }))
  })
});
```

#### 5.5.6 `pricing`

```ts
export const PricingSectionSchema = z.object({
  type: z.literal("pricing"),
  id: z.string().optional(),
  props: z.object({
    currency: z.string(),                   // ex. "€"
    highlight: z.number().int().min(0),
    plans: z.array(z.object({
      name: LocalizedString,
      price: z.string(),                    // ex. "29"
      period: z.string(),                   // ex. "mois"
      badge: LocalizedString.optional(),
      features: z.array(LocalizedString),
      cta: z.object({
        label: LocalizedString,
        href: z.string()
      })
    }))
  })
});
```

#### 5.5.7 `faq`

```ts
export const FAQSectionSchema = z.object({
  type: z.literal("faq"),
  id: z.string().optional(),
  props: z.object({
    accordion: z.boolean().default(true),
    items: z.array(z.object({
      q: LocalizedString,
      a: LocalizedString
    }))
  })
});
```

#### 5.5.8 `cta`

```ts
export const CTASectionSchema = z.object({
  type: z.literal("cta"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    backgroundImage: z.string().url().optional(),
    buttons: z.array(z.object({
      label: LocalizedString,
      href: z.string(),
      variant: z.string().optional()
    })),
    align: z.enum(["left","center","right"]).default("center")
  })
});
```

#### 5.5.9 `blogList`

```ts
export const BlogListSectionSchema = z.object({
  type: z.literal("blogList"),
  id: z.string().optional(),
  props: z.object({
    posts: z.array(z.object({
      id: z.string(),
      title: LocalizedString,
      excerpt: LocalizedString,
      slug: z.string(),
      publishedAt: z.string(),                // ISO date
      author: z.object({
        name: LocalizedString,
        avatar: z.string().url()
      }),
      featuredImage: z.string().url(),
      tags: z.array(LocalizedString),
      readTime: z.number().int().min(1)
    })),
    layout: z.enum(["grid","list"]).default("grid"),
    columns: z.number().int().min(1).max(4).default(3),
    pagination: z.boolean().default(false),
    postsPerPage: z.number().int().min(1).optional()
  })
});
```

#### 5.5.10 `contactForm`

```ts
export const ContactFormSectionSchema = z.object({
  type: z.literal("contactForm"),
  id: z.string().optional(),
  props: z.object({
    fields: z.array(z.object({
      name: z.string(),
      label: LocalizedString,
      type: z.enum(["text","email","tel","number","textarea","select","checkbox","radio","file"]),
      required: z.boolean().default(false),
      placeholder: LocalizedString.optional(),
      validation: z.string().optional(),
      options: z.array(LocalizedString).optional()
    })),
    submitLabel: LocalizedString,
    action: z.string(),                      // endpoint
    method: z.enum(["GET","POST"]).default("POST"),
    successMessage: LocalizedString.optional(),
    errorMessage: LocalizedString.optional()
  })
});
```

#### 5.5.11 `registerForm`, `loginForm`, `recoverPasswordForm`

> Même schéma que `contactForm` avec `type` respectif :
>
> * `registerForm`
> * `loginForm`
> * `recoverPasswordForm`

#### 5.5.12 `markdown`

```ts
export const MarkdownSectionSchema = z.object({
  type: z.literal("markdown"),
  id: z.string().optional(),
  props: z.object({
    md: z.string(),
    sourceType: z.enum(["inline","url"]).default("inline"),
    animation: z.string().optional()
  })
});
```

#### 5.5.13 `gallery`

```ts
export const GallerySectionSchema = z.object({
  type: z.literal("gallery"),
  id: z.string().optional(),
  props: z.object({
    images: z.array(z.object({
      src: z.string().url(),
      alt: LocalizedString,
      caption: LocalizedString.optional()
    })),
    columns: z.number().int().min(1).max(4),
    lightbox: z.boolean().default(false)
  })
});
```

#### 5.5.14 `video`

```ts
export const VideoSectionSchema = z.object({
  type: z.literal("video"),
  id: z.string().optional(),
  props: z.object({
    src: z.string(),
    provider: z.enum(["youtube","vimeo"]).default("youtube"),
    ratio: z.string().default("16/9"),
    controls: z.boolean().default(true),
    loop: z.boolean().default(false)
  })
});
```

#### 5.5.15 `table`

```ts
export const TableSectionSchema = z.object({
  type: z.literal("table"),
  id: z.string().optional(),
  props: z.object({
    headers: z.array(LocalizedString),
    rows: z.array(z.array(LocalizedString)),
    sortable: z.boolean().default(false),
    pagination: z.boolean().default(false),
    perPage: z.number().int().optional()
  })
});
```

#### 5.5.16 `chart`

```ts
export const ChartSectionSchema = z.object({
  type: z.literal("chart"),
  id: z.string().optional(),
  props: z.object({
    kind: z.enum(["bar","line","pie"]),
    data: z.array(z.record(z.union([z.string(), z.number()]))),
    xKey: z.string(),
    yKeys: z.array(z.string()),
    legend: z.boolean().default(false)
  })
});
```

#### 5.5.17 `map`

```ts
export const MapSectionSchema = z.object({
  type: z.literal("map"),
  id: z.string().optional(),
  props: z.object({
    center: z.tuple([z.number(), z.number()]),
    zoom: z.number().int().min(1).max(20),
    markers: z.array(z.object({
      position: z.tuple([z.number(), z.number()]),
      label: LocalizedString,
      popup: LocalizedString.optional()
    })),
    provider: z.string().default("leaflet")
  })
});
```

#### 5.5.18 `newsletter`

```ts
export const NewsletterSectionSchema = z.object({
  type: z.literal("newsletter"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    formAction: z.string(),
    emailPlaceholder: LocalizedString,
    submitLabel: LocalizedString,
    successMessage: LocalizedString
  })
});
```

#### 5.5.19 `comparison`

```ts
export const ComparisonSectionSchema = z.object({
  type: z.literal("comparison"),
  id: z.string().optional(),
  props: z.object({
    beforeImage: z.string().url(),
    afterImage: z.string().url(),
    beforeLabel: LocalizedString,
    afterLabel: LocalizedString,
    orientation: z.enum(["horizontal","vertical"]).default("horizontal")
  })
});
```

#### 5.5.20 `featureComparison`

```ts
export const FeatureComparisonSectionSchema = z.object({
  type: z.literal("featureComparison"),
  id: z.string().optional(),
  props: z.object({
    features: z.array(z.object({
      name: LocalizedString,
      description: LocalizedString
    })),
    plans: z.array(z.object({
      name: LocalizedString,
      features: z.array(z.union([z.boolean(), z.string()])),
      highlighted: z.boolean().default(false)
    }))
  })
});
```

#### 5.5.21 `socialFeed`

```ts
export const SocialFeedSectionSchema = z.object({
  type: z.literal("socialFeed"),
  id: z.string().optional(),
  props: z.object({
    platform: z.string(),                  // ex. "twitter"
    feedId: z.string(),                    // ex. "siteforge"
    limit: z.number().int().min(1).optional(),
    layout: z.enum(["grid","list"]).default("grid")
  })
});
```

#### 5.5.22 `search` (déprécié)

> Cette section de recherche a été retirée du schéma.
> Utilisez désormais [`searchPro`](#5534-searchpro) pour les fonctionnalités de recherche avancée.

#### 5.5.23 `eventList`

```ts
export const EventListSectionSchema = z.object({
  type: z.literal("eventList"),
  id: z.string().optional(),
  props: z.object({
    events: z.array(z.object({
      id: z.string(),
      title: LocalizedString,
      description: LocalizedString,
      startDate: z.string(),
      endDate: z.string(),
      location: LocalizedString,
      image: z.string().url().optional(),
      registrationUrl: z.string().optional(),
      price: z.string().optional(),
      tags: z.array(LocalizedString)
    })),
    layout: z.enum(["grid","list"]).default("grid"),
    showPastEvents: z.boolean().default(false)
  })
});
```

#### 5.5.24 `productShowcase`

```ts
export const ProductShowcaseSectionSchema = z.object({
  type: z.literal("productShowcase"),
  id: z.string().optional(),
  props: z.object({
    products: z.array(z.object({
      id: z.string(),
      name: LocalizedString,
      description: LocalizedString,
      price: z.string(),
      images: z.array(z.string().url()),
      features: z.array(LocalizedString),
      cta: z.object({
        label: LocalizedString,
        href: z.string()
      })
    })),
    layout: z.enum(["grid","carousel"]).default("grid"),
    showPrices: z.boolean().default(true)
  })
});
```

#### 5.5.25 `cookieConsent`

```ts
export const CookieConsentSectionSchema = z.object({
  type: z.literal("cookieConsent"),
  id: z.string().optional(),
  props: z.object({
    message: LocalizedString,
    acceptLabel: LocalizedString,
    declineLabel: LocalizedString,
    settingsLabel: LocalizedString,
    policyUrl: z.string(),
    position: z.enum(["bottom","top"]).default("bottom"),
    categories: z.array(z.object({
      id: z.string(),
      label: LocalizedString,
      description: LocalizedString,
      required: z.boolean().default(false)
    }))
  })
});
```

#### 5.5.26 `html`

```ts
export const HTMLSectionSchema = z.object({
  type: z.literal("html"),
  id: z.string().optional(),
  props: z.object({
    html: z.string()                      // contenu HTML brut
  })
});
```

#### 5.5.27 `banner`

```ts
export const BannerSectionSchema = z.object({
  type: z.literal("banner"),
  id: z.string().optional(),
  props: z.object({
    text: LocalizedString,             // texte du bandeau
    variant: z.string().optional(),    // ex. "info" | "warning"
    dismissible: z.boolean().default(false)
  })
});
```

---

#### 5.5.28 `breadcrumb`

```ts
export const BreadcrumbSectionSchema = z.object({
  type: z.literal("breadcrumb"),
  id: z.string().optional(),
  props: z.object({
    items: z.array(z.object({
      label: LocalizedString,
      href: z.string().optional()
    })),
    separator: z.string().default("/")
  })
});
```

---

#### 5.5.29 `tabs`

```ts
export const TabsSectionSchema = z.object({
  type: z.literal("tabs"),
  id: z.string().optional(),
  props: z.object({
    tabs: z.array(z.object({
      id: z.string(),
      title: LocalizedString,
      content: z.string()             // clé de section ou HTML inline
    })),
    defaultTab: z.string().optional()
  })
});
```

---

#### 5.5.30 `steps`

```ts
export const StepsSectionSchema = z.object({
  type: z.literal("steps"),
  id: z.string().optional(),
  props: z.object({
    steps: z.array(z.object({
      title: LocalizedString,
      description: LocalizedString,
      icon: z.string().optional()
    })),
    currentStep: z.number().int().min(0).optional()
  })
});
```

---

#### 5.5.31 `team`

```ts
export const TeamSectionSchema = z.object({
  type: z.literal("team"),
  id: z.string().optional(),
  props: z.object({
    members: z.array(z.object({
      name: LocalizedString,
      role: LocalizedString,
      bio: LocalizedString.optional(),
      avatar: z.string().url().optional(),
      socials: z.array(z.object({
        platform: z.string(),
        url: z.string().url()
      })).optional()
    })),
    layout: z.enum(["grid","carousel"]).default("grid"),
    columns: z.number().int().min(1).max(4).default(3)
  })
});
```

---

#### 5.5.32 `timeline`

```ts
export const TimelineSectionSchema = z.object({
  type: z.literal("timeline"),
  id: z.string().optional(),
  props: z.object({
    events: z.array(z.object({
      date: z.string(),                // ISO date
      title: LocalizedString,
      text: LocalizedString
    })),
    alternating: z.boolean().default(false)
  })
});
```

#### 5.5.33 `blogPost`

```ts
export const BlogPostSectionSchema = z.object({
  type: z.literal("blogPost"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString,
    excerpt: LocalizedString.optional(),
    content: LocalizedString,
    author: z.object({
      name: LocalizedString,
      avatar: z.string().optional(),
      bio: LocalizedString.optional(),
    }).optional(),
    publishedAt: z.string().optional(),
    tags: z.array(LocalizedString).optional(),
    featuredImage: z.string().optional(),
    readTime: z.number().optional(),
  }),
});
```

| Propriété       | Type                 | Description                                    |
| --------------- | -------------------- | ---------------------------------------------- |
| `title`         | `LocalizedString`    | Titre de l’article                             |
| `excerpt`       | `LocalizedString?`   | Résumé ou chapeau                              |
| `content`       | `LocalizedString`    | Contenu principal (Markdown inline ou fichier) |
| `author`        | `object?`            | Informations sur l’auteur                      |
| `publishedAt`   | `string?`            | Date de publication (ISO)                      |
| `tags`          | `LocalizedString[]?` | Liste de mots‑clés                             |
| `featuredImage` | `string?`            | URL de l’image à la une                        |
| `readTime`      | `number?`            | Durée de lecture estimée (minutes)             |

---

#### 5.5.34 `searchPro`

```ts
import { SearchProSectionSchema } from "@/modules/search/schema";
```

```ts
export const SearchProSectionSchema = z.object({
  type: z.literal("searchPro"),
  id:   z.string().optional(),

  props: z.object({
    title: LocalizedString.optional(),
    description: LocalizedString.optional(),
    placeholder: LocalizedString,
    useFilter:   z.boolean().default(true),
    showMap:     z.boolean().default(false),
    enableMap: z.boolean().default(true),
    showActiveFiltersTypes: z.boolean().default(true),
    showActiveFiltersTags: z.boolean().default(true),

    filters: z.record(z.string(), TagsFilterSchema).optional(),

    baseParams: z.object({
      fediverse:     z.boolean().optional(),
      indexStepList: z.number().optional(),
      indexStepMap:  z.number().optional(),
      defaultTypes:  z.array(SearchTypeSchema).optional(),
      defaultTags:   z.array(z.string()).optional(),
      defaultFilters: z.record(z.string(), z.unknown()).optional(),
      defaultFields:  z.array(z.string()).optional(),
      defaultSortBy: z.record(z.string(), z.union([z.literal(1), z.literal(-1)])).optional(),
      notSourceKey: z.boolean().optional(),
    }).optional(),

    list: ListConfSchema.optional(),
    map:  MapConfSchema.optional(),
  }),
});
```

| Propriété | Type | Description |
| --------- | ---- | ----------- |
| `title` | `LocalizedString?` | Titre affiché au-dessus de la recherche |
| `description` | `LocalizedString?` | Texte introductif optionnel |
| `placeholder` | `LocalizedString` | Texte du champ de recherche |
| `useFilter` | `boolean` | Afficher/masquer les filtres |
| `showMap` | `boolean` | Afficher/masquer la carte |
| `enableMap` | `boolean` | Charger les ressources cartographiques |
| `showActiveFiltersTypes` | `boolean` | Afficher les types actifs |
| `showActiveFiltersTags` | `boolean` | Afficher les tags actifs |
| `filters` | `Record<string, TagsFilterSchema>?` | Filtres personnalisés (tags, catégories) |
| `baseParams` | `object?` | Paramètres de base pour la recherche avancée |
| `list` | `ListConfSchema?` | Configuration de l’affichage en liste |
| `map` | `MapConfSchema?` | Configuration de l’affichage sur la carte |

#### Détails de `ListConfSchema`

```ts
const ListConfSchema = z.object({
  columns: z.object({
    lg: z.number().int().min(1).max(6).optional(),
    md: z.number().int().min(1).max(6).optional(),
    sm: z.number().int().min(1).max(6).optional(),
  }).partial().optional(),
  card: z.object({
    tagLimit:        z.number().int().min(1).max(50).optional(),
    showDescription: z.boolean().optional(),
    showAddress:     z.boolean().optional(),
    shareButton:     z.boolean().optional(),
    detailsMode:     z.enum(["drawer", "dialog"]).default("drawer"),
    type:            z.enum(["overlay", "default"]).default("default"),
  }).partial().optional(),
  preview: z.object({
    type: z.enum(["default"]).default("default"),
  }).partial().optional(),
}).partial();
```

* **`card.type`** : `overlay` (texte sur l’image) ou `default`.
* **`card.detailsMode`** : affichage des détails dans un `drawer` ou un `dialog`.
* **`preview.type`** : type de prévisualisation (actuellement `default`).

#### Détails de `MapConfSchema`

```ts
const MapConfSchema = z.object({
  initialZoom: z.number().min(1).max(20).optional(),
  cluster:     z.boolean().optional(),
  popup: z.object({
    type: z.enum(["default"]).default("default"),
  }).partial().optional(),
}).partial();
```

* **`popup.type`** : type de popup sur la carte (actuellement `default`).

---

### 5.6 `FooterSchema`

```ts
FooterSchema = z.object({
  columns: z.array(FooterColumn),
  socials?: z.array(z.object({ platform: z.string(), url: z.string() })),
  extra?: z.string(),
  newsletter?: NewsletterSectionSchema,
  copyright: LocalizedString,
  logo?: z.string(),
  description?: LocalizedString,
  legalLinks?: z.array(z.object({ href: z.string(), label: LocalizedString })),
  paymentMethods?: z.array(z.string())
});
```

* **socials** (`{ platform: string; url: string }[]`)
* **extra** (`string`) : HTML ou texte complémentaire.
* **newsletter** (`NewsletterSectionSchema`) : configuration du formulaire d’abonnement.
* **logo**, **description** (`LocalizedString`) : logo du footer et texte descriptif.
* **legalLinks** (`{ href: string; label: LocalizedString }[]`) : liens légaux.
* **paymentMethods** (`string[]`) : icônes ou identifiants de moyens de paiement.

---

### 5.7 `IntegrationsSchema`

```ts
IntegrationsSchema = z.object({
  analytics?: AnalyticsIntegration,
  chat?: ChatIntegration,
  scripts?: z.array(ScriptTag),
  seo?: SEOIntegration,
  ecommerce?: EcommerceIntegration,
  email?: EmailIntegration,
  crm?: CRMIntegration
});
```

* **analytics** (`AnalyticsIntegration`)
* **chat** (`ChatIntegration`)
* **scripts** (`ScriptTag[]`) : injections de `<script>` conditionnelles.
* **seo** (`SEOIntegration`)
* **ecommerce** (`EcommerceIntegration`)
* **email** (`EmailIntegration`)
* **crm** (`CRMIntegration`)

---

### 5.8 `FeatureFlagSchema`

```ts
FeatureFlagSchema = z.object({
  key: z.string(),
  enabled: z.boolean().default(false),
  variant?: z.string(),
  description?: z.string(),
  rolloutPercentage: z.number().min(0).max(100).default(100),
  conditions?: z.record(z.any())
});
```

* **key** : identifiant du flag.
* **enabled** : active ou non la feature.
* **variant** : variante du test A/B.
* **description** : information sur le flag.
* **rolloutPercentage** : pourcentage d’utilisateurs ciblés.
* **conditions** : filtre segmenté (IP, géolocalisation…).

---

### 5.9 `ThemeConfigSchema`

```ts
ThemeConfigSchema = z.object({
  colors: z.object({ light: ColorPalette, dark: ColorPalette }),
  typography: Typography,
  spacing: Spacing,
  borderRadius: BorderRadius,
  animations: z.object({
    enabled: z.boolean().default(true),
    duration: z.enum(["fast","normal","slow"]).default("normal")
  }),
  customCSS?: z.string()
});
```

* **colors** : palettes `light` et `dark`.
* **typography** : famille de fontes, tailles, poids.
* **spacing** : échelles de marges/paddings.
* **borderRadius** : rayons d’arrondi.
* **animations** : activation et durée par défaut.
* **customCSS** : CSS global additionnel.

---

### 5.10 `PerformanceConfigSchema`

```ts
PerformanceConfigSchema = z.object({
  lazyLoading: z.boolean().default(true),
  imageOptimization: z.boolean().default(true),
  caching: z.object({
    enabled: z.boolean().default(true),
    strategy: z.enum(["stale-while-revalidate","cache-first","network-first"]).default("stale-while-revalidate"),
    maxAge: z.number().default(3600)
  }),
  compression: z.boolean().default(true),
  minification: z.boolean().default(true),
  criticalCSS: z.boolean().default(true)
});
```

* **lazyLoading** : activer le chargement différé.
* **imageOptimization** : optimiser les images à la volée.
* **caching** : stratégie et durée de cache.
* **compression** : activer gzip/brotli.
* **minification** : minifier HTML/CSS/JS.
* **criticalCSS** : extraire le CSS critique.

---

### 5.11 `AdvancedSiteConfig`

```ts
SiteConfigSchema.extend({
  redirects?: z.array(z.object({ from: z.string(), to: z.string(), permanent: z.boolean().default(false) })),
  customDomains?: z.array(z.string()),
  maintenance?: z.object({
    enabled: z.boolean().default(false),
    message?: LocalizedString,
    allowedIPs?: z.array(z.string())
  })
});
```

* **redirects** (`{ from, to, permanent }[]`) : règles de redirection.
* **customDomains** (`string[]`) : domaines supplémentaires.
* **maintenance** : mode maintenance avec message et IPs autorisées.

**Helpers & Exemples**

* `validateSiteConfig(config: unknown): SiteConfig` — validation runtime
* `getDefaultSiteConfig(): Partial<SiteConfig>` — valeurs par défaut
* `example: SiteConfig` — exemple type‑safe fourni

---

## 6. Sections dynamiques

Cette partie explique comment SiteForge transforme votre configuration JSON en composants React, grâce à un moteur générique de rendu des sections.

---

### 6.1 Vue d’ensemble de `SectionRenderer.tsx`

Le fichier `src/components/sections/SectionRenderer.tsx` centralise le rendu de toutes les sections. Son principe :

1. **Mapping** : il associe chaque `type` de section (ex. `"hero"`) à un composant React précis (`HeroSection`).
2. **Validation** : avant le rendu, il valide le JSON via le schéma Zod correspondant.
3. **Rendu** : il injecte les `props` validés dans le composant.

#### Extrait simplifié

```tsx
import { HeroSection } from "./HeroSection";
import { CardsSection } from "./CardsSection";
// … import de tous les composants

const sectionMap: Record<string, React.FC<any>> = {
  hero: HeroSection,
  cards: CardsSection,
  stats: StatsSection,
  gallery: GallerySection,
  searchPro: SearchProSection,
  // … tous les autres
};

export const SectionRenderer: React.FC<{
  section: Section; // 타입 SiteConfig.pages[].sections[n]
}> = ({ section }) => {
  const Component = sectionMap[section.type];
  if (!Component) return null;
  return <Component {...section.props} />;
};
```

---

### 6.2 Propriétés communes à toutes les sections

Bien que chaque section possède son propre schéma Zod et ses props spécifiques, certaines conventions sont partagées :

* **`type`** : identifiant unique (string littéral).
* **`id`** (optionnel) : permet l’ancrage (`<section id={id}>`).
* **`props`** : objet validé contenant toutes les données nécessaires au composant.

Ces conventions garantissent que `SectionRenderer` peut traiter **toutes** les sections uniformément.

---

### 6.3 Description rapide des principaux types de section

| Type            | Composant             | Usage principal                                                        |
| --------------- | --------------------- | ---------------------------------------------------------------------- |
| **hero**        | `HeroSection`         | Bandeau d’accueil avec titre, sous-titre, image de fond et boutons CTA |
| **cards**       | `CardsSection`        | Grille de cartes illustratives                                         |
| **stats**       | `StatsSection`        | Affichage chiffré (valeurs, icônes)                                    |
| **gallery**     | `GallerySection`      | Galerie d’images avec lightbox                                         |
| **searchPro**   | `SearchProSection`    | Module de recherche avancée avec filtres et carte                      |
| **pricing**     | `PricingSection`      | Présentation des offres et tarifs                                      |
| **faq**         | `FAQSection`          | Liste de questions/réponses accordéon                                  |
| **blogList**    | `BlogListSection`     | Liste ou grille d’articles                                             |
| **contactForm** | `ContactFormSection`  | Formulaire de contact configurable                                     |
| **testimonial** | `TestimonialsSection` | Témoignages clients avec carousel                                      |
| **map**         | `MapSection`          | Carte interactive (Leaflet)                                            |
| …               | …                     | …                                                                      |

Chaque composant se trouve dans `src/components/sections/<Type>Section.tsx` et lit ses props typés.

---

### 6.4 Comment ajouter ou personnaliser une nouvelle section

Pour créer une section sur mesure :

1. **Définir le schéma Zod**

   ```ts
   // src/components/sections/schemas/MySectionSchema.ts
   import { z } from "zod";
   import { LocalizedString } from "@/types/locale-schema";

   export const MySectionSchema = z.object({
     type: z.literal("mySection"),
     id: z.string().optional(),
     props: z.object({
       title: LocalizedString,
       items: z.array(z.string())
     })
   });
   export type MySection = z.infer<typeof MySectionSchema>;
   ```

2. **Créer le composant React**

   ```tsx
   // src/components/sections/MySection.tsx
   import React from "react";
   import { MySection } from "./schemas/MySectionSchema";

   export const MySection: React.FC<MySection["props"]> = ({ title, items }) => (
     <section>
       <h2>{title.fr}</h2>
       <ul>
         {items.map((item, i) => <li key={i}>{item}</li>)}
       </ul>
     </section>
   );
   ```

3. **Enregistrer dans le moteur**

   * **Import** dans `SectionRenderer.tsx` :

     ```ts
     import { MySection } from "./MySection";
     import { MySectionSchema } from "./schemas/MySectionSchema";
     ```
   * **Ajouter au mapping** :

     ```ts
     sectionMap["mySection"] = MySection;
     ```
   * **Et** à l’union des schémas (`src/types/site-schema.ts`) pour valider `pages[].sections`.

4. **Mettre à jour la configuration JSON**
   Dans `config.prod.json` (ou fichier `.env` via `SITE_CONFIG_JSON`), ajoutez une section :

   ```json
   {
     "type": "mySection",
     "props": {
       "title": { "fr": "Ma section perso", "en": "My custom section" },
       "items": ["Item 1", "Item 2"]
     }
   }
   ```

---

## 7. Modules fonctionnels

Les **modules** de SiteForge apportent des logiques avancées au-delà des simples sections. Chaque module est organisé sous `src/modules/<moduleName>` et se compose généralement de :

* **Composants** (`components/`)
* **Hooks** (`hooks/`)
* **Contexts** (`contexts/`)
* **Schéma de validation** (`schema.ts`)
* **Fichiers de localisation** (`i18n/`)

Nous détaillons ici le **module Search** comme exemple, puis donnons un aperçu des autres modules.

---

### 7.1 Module Search (`src/modules/search`)

Ce module permet d’afficher une interface de recherche avancée avec filtres, liste et carte.

#### 7.1.1 Architecture interne

```
src/modules/search/
├── components/
│   ├── ActiveFiltersBar.tsx
│   ├── FilterDropdown.tsx
│   ├── SearchCard.tsx
│   ├── SearchCardSkeleton.tsx
│   ├── SearchFilters.tsx
│   ├── SearchListView.tsx
│   ├── SearchListSkeleton.tsx
│   ├── SearchMap.tsx
│   ├── SearchMapWrapper.tsx
│   ├── SearchProSection.tsx
│   ├── SwitchDetailsMode.tsx
│   ├── card/
│   │   ├── CardDefault.tsx
│   │   └── CardOverlay.tsx
│   ├── detailsMode/
│   │   ├── DetailsModeDialog.tsx
│   │   └── DetailsModeDrawer.tsx
│   ├── mapPopup/
│   │   └── MapPopupDefault.tsx
│   ├── preview/
│   │   └── PreviewDefault.tsx
│   └── renderMapPopup.tsx
├── contexts/
│   └── SearchPropsContext.tsx
├── hooks/
│   ├── loadLeaflet.ts         // Chargement dynamique de Leaflet
│   ├── useItem.tsx            // Fusion données serveur/valeurs par défaut
│   └── useSearchFilters.ts    // Gestion des états de filtres
├── i18n/
│   ├── en.json
│   └── fr.json
├── i18n.ts                    // Pont vers react-i18next
├── schema.ts                  // Schéma Zod du module (SearchProSectionSchema)
└── index.ts                   // Export centralisé
```

#### 7.1.2 Schéma de configuration (`schema.ts`)

Le schéma `SearchProSectionSchema` (voir section 5.5.34) définit toutes les props configurables :

* `title`, `description`: textes d'en-tête
* `placeholder`: texte du champ
* `useFilter`, `showMap`, `enableMap`: booléens d’activation
* `showActiveFiltersTypes`, `showActiveFiltersTags`: affichage des filtres actifs
* `filters`: structure des filtres (tags, type)
* `baseParams`: paramètres initiaux (API)
 * `list`: configuration liste (colonnes, type de carte, mode de détails, prévisualisation)
 * `map`: configuration carte (zoom, cluster, type de popup)

#### 7.1.3 Context et hooks

* **`SearchPropsContext`** expose les props validées à tous les composants enfants (filtres, liste, carte).
* **`useSearchFilters`** gère l’état local des filtres (sélection, reset).
* **`loadLeaflet`** importe dynamiquement le bundle Leaflet uniquement si `showMap` est à `true` (optimisation du bundle).
* **`useItem`** fusionne les données serveur avec des valeurs par défaut et normalise la structure.

#### 7.1.4 Composants clés

| Composant          | Rôle                                                 |
| ------------------ | ---------------------------------------------------- |
| `SearchProSection` | Point d’entrée : assemble filtres, liste, carte.     |
| `ActiveFiltersBar` | Affiche les filtres actifs et permet de les retirer. |
| `FilterDropdown`   | Dropdown pour sélectionner filtres.                  |
| `SearchListView`   | Affiche la liste des résultats et gère `SwitchDetailsMode`. |
| `SearchMapWrapper` | Conteneur Leaflet avec `renderMapPopup`.                   |
| `SearchCard`       | Carte individuelle (`CardDefault` ou `CardOverlay`).        |
| `SwitchDetailsMode`| Ouvre les détails en `drawer` ou `dialog`.                 |
| `PreviewDefault`   | Prévisualisation standard des informations.               |
| `MapPopupDefault`  | Popup par défaut pour les marqueurs de carte.             |

#### 7.1.5 Exemple de configuration JSON

```json
{
  "type": "searchPro",
  "props": {
    "title": { "fr": "Recherche", "en": "Search" },
    "description": { "fr": "Trouvez des ressources", "en": "Find resources" },
    "placeholder": { "fr": "Rechercher...", "en": "Search..." },
    "useFilter": true,
    "showMap": true,
    "enableMap": true,
    "showActiveFiltersTypes": true,
    "showActiveFiltersTags": true,
    "filters": {
      "tags": {
        "type": "tags",
        "name": { "fr": "Thèmes", "en": "Topics" },
        "list": [{ "fr": "Culture", "en": "Culture" }, { "fr": "Sport", "en": "Sport" }]
      }
    },
    "baseParams": { "indexStepList": 12, "defaultTypes": ["event","project"] },
    "list": {
      "columns": { "lg": 3 },
      "card": { "type": "overlay", "detailsMode": "drawer" },
      "preview": { "type": "default" }
    },
    "map": { "initialZoom": 10, "popup": { "type": "default" } }
  }
}
```

---

### 7.2 Autres modules à faire et documenter

* **EventList** (`src/modules/eventList`)

  * Schéma (`schema.ts`), Hook `useEventList`, composant `EventListSection`
* **ContactForm** (`src/modules/contactForm`)

  * Schéma, Hook `useContactForm`, composant `ContactFormSection`
* **Blog** (`src/modules/blog`)

  * Schéma posts, Hook `useBlogPosts`, composant `BlogListSection`
* **Newsletter** (`src/modules/newsletter`)

  * Schéma, Hook `useNewsletter`, composant `NewsletterSection`

Chaque module suit la même structure :

1. **Validation des props** avec Zod.
2. **Context/Hooks** pour la logique métier.
3. **Composants** pour l’UI.
4. **i18n** pour textes multi-langues.

---

## 8. API Client & Authentification

Le client d’API et le système d’authentification de SiteForge reposent sur le package `@communecter/cocolight-api-client`, configuré et initialisé via un contexte React.

---

### 8.1 Initialisation de l’API (`apiClient.ts`)

Le fichier `src/lib/apiClient.ts` expose une fonction `initApiClient` qui crée et configure une instance `ApiClient` :

```ts
import { ApiClient } from "@communecter/cocolight-api-client";
import { readEnv } from "./utils";

export function initApiClient() {
  const baseUrl = readEnv("VITE_BASE_URL_BACKEND", "http://localhost:3000");
  const client = new ApiClient({
    baseURL: baseUrl,
    // injection des stratégies de stockage de tokens
    tokenStorage: new MultiServerTokenStorageStrategy(),
    // gestion des retries, circuit breaker, etc.
    axiosOptions: { /* retry, timeout… */ }
  });
  return client;
}
```

* **`baseURL`** : URL du backend, issue de `VITE_BASE_URL_BACKEND`.
* **`tokenStorage`** : stratégie de stockage (voir 8.2).
* **`axiosOptions`** : options de retry et timeout pour la résilience.

---

### 8.2 Stratégies de stockage des tokens

#### 8.2.1 MultiServerTokenStorageStrategy

Implémentée dans `src/lib/utils/MultiServerTokenStorageStrategy.js`, cette classe :

* Stocke les tokens (access + refresh) distinctement par serveur (par `origin`).
* Permet l’authentification simultanée sur plusieurs instances Communecter.
* Expose les méthodes :

  * `get(serverUrl)`, `set(serverUrl, tokens)`, `clear(serverUrl)`.

#### 8.2.2 MemoryStorageStrategy

Implémentée dans `src/lib/utils/TokenStorage.js`, pour usage simple ou tests :

* Stocke les tokens en mémoire (non persistant).
* Méthodes : `get()`, `set(tokens)`, `clear()`.

---

### 8.3 Contexte React (`CocolightContext`)

Le contexte `CocolightContext` et son provider `CocolightProvider` se trouvent dans `src/contexts/CocolightContext.tsx` et `CocolightProvider.tsx`.

```tsx
// CocolightContext.tsx
export const CocolightContext = createContext<ApiClient | null>(null);
```

```tsx
// CocolightProvider.tsx
import { initApiClient } from "@/lib/apiClient";
import { CocolightContext } from "./CocolightContext";

export const CocolightProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const client = useMemo(() => initApiClient(), []);
  return (
    <CocolightContext.Provider value={client}>
      {children}
    </CocolightContext.Provider>
  );
};
```

* **`initApiClient()`** est appelé une seule fois via `useMemo`.
* Le client est accessible à tout composant via le contexte.

---

### 8.4 Hooks d’accès au client

#### 8.4.1 `useCocolight`

```ts
export function useCocolight(): ApiClient {
  const client = useContext(CocolightContext);
  if (!client) {
    throw new Error("useCocolight must be used within CocolightProvider");
  }
  return client;
}
```

* Retourne l’instance `ApiClient` ou lève une erreur si le provider n’est pas monté.

#### 8.4.2 `useCocolightInit`

```ts
export function useCocolightInit() {
  const client = useCocolight();
  useEffect(() => {
    client.init(); // charge tokens depuis storage et refresh si besoin
  }, [client]);
}
```

* À appeler dans un composant racine (`RootLayout`) pour initialiser l’authentification au mount.

---

### 8.5 Flux d’authentification

1. **Login**

   * Le component `LoginForm` appelle `client.user().login({ email, password })`.
   * En cas de succès, les tokens sont stockés via la stratégie configurée.

2. **Requête API**

   * `ApiClient` injecte automatiquement le token d’accès dans l’en-tête `Authorization`.
   * En cas de 401, il tente un refresh via le token de rafraîchissement, puis retry.

3. **Logout**

   * Appel de `client.user().logout()`, puis `tokenStorage.clear()`.
   * Redirection ou mise à jour du state d’authentification.

---

### 8.6 Exemple d’intégration

```tsx
// RootLayout.tsx
import { CocolightProvider } from "@/contexts/CocolightProvider";
import { useCocolightInit } from "@/hooks/useCocolightInit";

const Layout: FC = ({ children }) => {
  useCocolightInit();
  return (
    <CocolightProvider>
      {children}
    </CocolightProvider>
  );
};
```

Dans un composant :

```tsx
import { useCocolight } from "@/hooks/useCocolight";

export function Profile() {
  const client = useCocolight();
  const { data: me } = useQuery(["me"], () => client.user().get());
  return <div>Bonjour, {me.serverData.name}</div>;
}
```

---

## 9. Sécurité et validation

La robustesse de SiteForge repose sur plusieurs couches de validation et de protection pour éviter les vulnérabilités courantes (injections, XSS, CSRF…).

---

### 9.1 Validation des schémas JSON (Zod)

Toutes les données provenant de la configuration JSON sont validées **au runtime** grâce à Zod. Cela permet :

* **Détecter les valeurs manquantes** ou hors-type avant le rendu.
* **Empêcher l’exécution** de sections mal configurées.
* **Générer** des types TypeScript fiables (`z.infer<…>`) pour l’autocomplétion et le refactoring.

```ts
import { SiteConfigSchema } from "@/types/site-schema";

try {
  const config = SiteConfigSchema.parse(window.__CONFIG__);
} catch (err) {
  console.error("Configuration invalide :", err.errors);
  // Arrêter l’exécution ou afficher un message d’erreur convivial
}
```

> **Bonnes pratiques**
>
> * Toujours `.parse()` (qui lance une exception) ou `.safeParse()` (qui renvoie un objet `{ success, error }`).
> * Ne jamais se fier à du simple `typeof` ou des assertions manuelles.

---

### 9.2 Sanitisation du contenu (DOMPurify)

Certains champs (Markdown inline, HTML dans `html` ou `markdown` sections) peuvent contenir du code HTML. Pour prévenir le **Cross‑Site Scripting (XSS)** :

* Utilisation de **DOMPurify** pour nettoyer tout HTML avant insertion dans le DOM.

```ts
import DOMPurify from "dompurify";

// Dans MarkdownSection.tsx
const cleanHtml = useMemo(() => DOMPurify.sanitize(props.md), [props.md]);
return <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
```

> **Remarque** : ne jamais utiliser `dangerouslySetInnerHTML` sans cette étape de sanitisation.

---

## 10. Performance et optimisation

Pour garantir une expérience utilisateur fluide et un chargement rapide, plusieurs techniques d’optimisation sont mises en œuvre, tant côté client que côté serveur.

---

### 10.1 Lazy loading des sections et des images

#### 10.1.1 Chargement asynchrone des sections

Le rendu des sections utilise désormais `React.lazy` et `Suspense` **dans** `SectionRenderer.tsx` :

```tsx
// src/components/sections/SectionRenderer.tsx
import React, { Suspense, lazy } from "react";
import type { Section } from "@/types/site";

// Import dynamique de chaque section
const LazyHeroSection      = lazy(() => import("./HeroSection"));
const LazyCardsSection     = lazy(() => import("./CardsSection"));
const LazyStatsSection     = lazy(() => import("./StatsSection"));
const LazyGallerySection   = lazy(() => import("./GallerySection"));
const LazySearchProSection = lazy(() => import("./SearchProSection"));
// … et ainsi de suite pour toutes les sections

const lazySectionMap: Record<string, React.LazyExoticComponent<React.FC<any>>> = {
  hero: LazyHeroSection,
  cards: LazyCardsSection,
  stats: LazyStatsSection,
  gallery: LazyGallerySection,
  searchPro: LazySearchProSection,
  // … toutes les autres sections
};

export const SectionRenderer: React.FC<{ section: Section }> = ({ section }) => {
  const Component = lazySectionMap[section.type];
  if (!Component) return null;
  return (
    <Suspense fallback={<div>Chargement…</div>}>
      <Component {...section.props} />
    </Suspense>
  );
};
```

* Chaque section est packagée dans un chunk distinct.
* Lors du rendu, seule la section visible est téléchargée.
* Le fallback `<div>Chargement…</div>` garantit un affichage minimal pendant le chargement.

#### 10.1.2 Lazy loading des images

Le composant `LazyImage` (dans `src/components/layout/LazyImage.tsx`) combine l’API `IntersectionObserver` et l’attribut natif `loading="lazy"` :

```tsx
import React, { useState, useRef, useEffect } from "react";

export const LazyImage: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const [visible, setVisible] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <img
      ref={imgRef}
      src={visible ? src : undefined}
      data-src={src}
      alt={alt}
      loading="lazy"
    />
  );
};
```

* **IntersectionObserver** déclenche le chargement lorsque l’image entre dans le viewport.
* `loading="lazy"` active le lazy loading natif sur les navigateurs compatibles.

---

### 10.2 Code splitting et bundling

* **Entrées multiples** : Vite sépare le code `entry-client.tsx` et `entry-server.tsx` en bundles distincts.
* **Chunks par import dynamique** : chaque `React.lazy` crée un nouveau chunk, optimisant le cache et le parallélisme.
* **Configuration Vite** (`vite.config.ts`) :

  ```ts
  ssr: { noExternal: ["@radix-ui/", "lucide-react"] },
  build: {
    rollupOptions: {
      output: { manualChunks: { /* grouping spécifique */ } }
    }
  }
  ```

---

### 10.3 Optimisation des images

* **Composant `Image.tsx`** génère automatiquement un `srcSet` pour plusieurs résolutions :

  ```tsx
  export function Image({ src, alt, sizes }: { src: string; alt: string; sizes?: string }) {
    const srcSet = `${src}?w=300 300w, ${src}?w=600 600w, ${src}?w=900 900w`;
    return <img src={src} srcSet={srcSet} sizes={sizes} alt={alt} />;
  }
  ```
* Intégration possible de **plugins Vite** (ex. `vite-imagetools`) pour transformer et optimiser les images à la volée.

---

### 10.4 Caching et hydratation des données

* **React Query** gère le cache des requêtes API :

  ```tsx
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 300_000, cacheTime: 1_800_000, retry: 1 }
    }
  });
  ```
* **Streaming SSR + Hydrate** :

  * Côté serveur, on collecte l’état via `dehydrate(queryClient)` après toutes les requêtes.
  * Côté client, `Hydrate` réinjecte cet état pour éviter de refetcher.

---

### 10.5 Compression et réseau

* **Compression gzip** (Express) :

  ```js
  import compression from "compression";
  app.use(compression());
  ```
* **HTTP/2** : conseillé pour réduire la latence des multiples requêtes de chunks.
* **Préfetch / Preconnect** dans le `<head>` :

  ```html
  <link rel="preconnect" href="https://api.monsite.com">
  <link rel="preload" href="/assets/hero-section.js" as="script">
  ```

---

## 11. Internationalisation (i18n)

La localisation de SiteForge repose principalement sur le type **`LocalizedString`** défini dans la configuration JSON et un contexte React dédié, complété par un hook `useT` pour rendre facilement les chaînes au component.

---

### 11.1 `LocalizedString` dans la configuration

```ts
// src/types/locale-schema.ts
export const LOCALES = ["fr", "en"] as const;
export type Locale = typeof LOCALES[number];
export const LocalizedString = z.record(z.enum(LOCALES), z.string());
```

* Toute valeur textuelle fournie par le site (titres, sous-titres, libellés…) utilise ce format :

  ```json
  {
    "headline": { "fr": "Bienvenue", "en": "Welcome" }
  }
  ```

---

### 11.2 Contexte de localisation

#### 11.2.1 Définition du contexte

```tsx
// src/contexts/LocalizationContext.tsx
import { createContext } from "react";
import type { Locale } from "@/types/locale-schema";

export interface LocalizationContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const LocalizationContext = createContext<LocalizationContextValue>({
  locale: "fr",
  setLocale: () => {}
});
```

#### 11.2.2 Provider

```tsx
// src/contexts/LocalizationProvider.tsx
import { FC, useState, useEffect } from "react";
import { LocalizationContext } from "./LocalizationContext";
import { LOCALES } from "@/types/locale-schema";
import { readEnv } from "@/lib/utils";

export const LocalizationProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialisation à partir de la config ou variable d'env
  const defaultLang = (readEnv("VITE_DEFAULT_LANG", LOCALES[0]) as Locale);
  const [locale, setLocale] = useState<Locale>(defaultLang);

  // Optionnel : persistance en localStorage
  useEffect(() => {
    localStorage.setItem("locale", locale);
  }, [locale]);

  return (
    <LocalizationContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocalizationContext.Provider>
  );
};
```

* **`locale`** : code de la langue active.
* **`setLocale`** : pour changer dynamiquement la langue.

---

### 11.3 Hook `useT`

```ts
// src/hooks/useT.tsx
import { useContext } from "react";
import { LocalizationContext } from "@/contexts/LocalizationContext";
import type { LocalizedString } from "@/types/locale-schema";

export function useT() {
  const { locale } = useContext(LocalizationContext);
  return (value: LocalizedString): string => {
    return value[locale] ?? value[Object.keys(value)[0] as keyof LocalizedString];
  };
}
```

* Retourne une fonction **`t`** qui, pour un objet `{ fr, en }`, renvoie la chaîne correspondant à la langue courante, ou la première disponible.

---

### 11.4 Exemple d’utilisation

```tsx
import { useT } from "@/hooks/useT";

export function HeroSection({ props }) {
  const t = useT();
  return (
    <section>
      <h1>{t(props.headline)}</h1>
      {props.subhead && <p>{t(props.subhead)}</p>}
    </section>
  );
}
```

Chaque composant de section se sert ainsi de `useT()` pour afficher **toutes** les valeurs traduites.

---

#### 11.5 Cas particuliers : modules et composants hors configuration JSON

Certaines chaînes (dans les composants « layout », « ui », modules d’authentification, recherche, etc.) ne sont **pas** dans la config JSON et utilisent `react-i18next` de façon dynamique via :

* **`useLoadNamespace(namespace: string)`** : charge à la demande le fichier de traduction
* **`useT(namespace: string)`** : renvoie une fonction de traduction pour ce namespace

---

##### 11.5.1 Chargement dynamique d’un namespace

Dans n’importe quel composant :

```tsx
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";

// Exemple pour le module d’authentification
export function LoginForm() {
  // Charge à la volée les JSON de traduction sous /components/auth/i18n
  const { loaded } = useLoadNamespace("components/auth");
  const t = useT("components/auth");

  if (!loaded) return <div>Chargement des traductions…</div>;

  return (
    <form>
      <label>{t("email_label")}</label>
      <input type="email" placeholder={t("email_placeholder")} />
      <button>{t("submit_button")}</button>
    </form>
  );
}
```

* **`useLoadNamespace("components/auth")`** :

  * Charge `src/components/auth/i18n/fr.json` et `en.json` via un import dynamique.
  * Renvoie `{ loaded: boolean }` pour indiquer quand la ressource est prête.

* **`useT("components/auth")`** :

  * Retourne une fonction `t(key: string): string` qui va chercher `key` dans le namespace chargé.
  * Exemple : `t("submit_button")` → `"Se connecter"` en français ou `"Login"` en anglais.

---

##### 11.5.2 Organisation des fichiers i18n

Chaque namespace correspond au **path** du dossier contenant le fichier `i18n` :

```
src/components/auth/i18n/fr.json
src/components/auth/i18n/en.json

src/modules/search/i18n/fr.json
src/modules/search/i18n/en.json

src/components/ui/button/i18n/fr.json
src/components/ui/button/i18n/en.json
```

Et ainsi de suite pour tous les composants/modules qui ont leurs propres libellés.

---

##### 11.5.3 Implémentation des hooks

* **`useLoadNamespace`** (simplifié) :

  ```ts
  // src/hooks/useLoadNamespace.tsx
  import { useState, useEffect } from "react";
  import i18n from "@/contexts/I18nBridge"; // instance i18next

  export function useLoadNamespace(ns: string) {
    const [loaded, setLoaded] = useState(i18n.hasResourceBundle(i18n.language, ns));
    useEffect(() => {
      if (!loaded) {
        i18n.loadNamespaces(ns, () => setLoaded(true));
      }
    }, [ns, loaded]);
    return { loaded };
  }
  ```

* **`useT`** :

  ```ts
  // src/hooks/useT.tsx
  import { useTranslation } from "react-i18next";

  export function useT(ns: string) {
    const { t } = useTranslation(ns, { useSuspense: false });
    return t;
  }
  ```

---


## 12. Backend et SSR

Cette section décrit en détail le fonctionnement des fichiers responsables du serveur de développement, du serveur de production, ainsi que des points d’entrée SSR et client.

---

### 12.1 `server/dev-server.js`&#x20;

1. **Chargement des variables d’environnement**

   ```js
   import dotenv from "dotenv";
   dotenv.config();
   ```

2. **Création du serveur Express + Vite middleware**

   ```js
   const vite = await createViteServer({
     server: { middlewareMode: true },
     appType: "custom",
     ssr: { noExternal: ["@radix-ui/*", "lucide-react", "@communecter/cocolight-api-client"] },
   });
   app.use(vite.middlewares);
   ```

   * `middlewareMode: true` active HMR et compilation à la volée.
   * `noExternal` force Vite à bundler ces dépendances pour SSR .

3. **Filtrage des requêtes statiques non gérées**
   Toutes les URL correspondant à assets (images, CSS, JS, etc.) renvoient un 404 pour éviter le SSR inutile .

4. **Route catch‑all SSR**

   ```js
   app.use(["/{*all}"], async (req, res) => {
     const template = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf-8");
     const html = await vite.transformIndexHtml(url, template);
     const { demoSiteConfig } = await vite.ssrLoadModule("/src/data/demo-site.ts");
     const cfgScript = `<script>window.__CONFIG__=${serialize(demoSiteConfig)}</script>`;
     // découpe template sur <!--app-head--> et <!--app-html-->
     res.write(headStart);
     res.write(cfgScript);
     const { render } = await vite.ssrLoadModule("/src/entry-server.tsx");
     await render(req, res, demoSiteConfig, (helmetHead, state) => {
       res.write(helmetHead);
       res.write(`<script>window.__REACT_QUERY_STATE__=${serialize(state)}</script>`);
       res.write(beforeBody);
     });
   });
   ```

   * Injection **unique** de `window.__CONFIG__` avant tout head .
   * Appel de `render(req,res,config, onHead)` pour streamer Helmet et React Query state.

5. **Démarrage du serveur**

   ```js
   app.listen(process.env.PORT || 5173);
   ```

---

### 12.2 `server/prod-server.js`&#x20;

1. **Compression et static serving**

   ```js
   app.use(compression());
   app.use(serveStatic(path.resolve(__dirname, "../dist/client"), { index: false }));
   ```
2. **Chargement de la configuration en production**
   Fonction `loadSiteConfig()` lit soit `SITE_CONFIG_JSON`, soit `SITE_CONFIG_PATH`, et lance une erreur si aucun n’est défini .
3. **Filtrage des assets**
   Même pattern que le dev‑server pour éviter SSR sur les fichiers statiques.
4. **Route SSR universelle**

   ```js
   app.use(['/{*all}'], async (req, res) => {
     const template = fs.readFileSync("../dist/client/index.html", "utf-8");
     const siteConfig = await loadSiteConfig();
     const configScript = `<script>window.__CONFIG__=${serialize(siteConfig)}</script>`;
     const envScript = /* injection window.__ENV__ si défini */;
     res.write(headStart);
     res.write(configScript);
     res.write(envScript);
     const { render } = await import("../dist/server/entry-server.js");
     await render(req, res, siteConfig, (helmetHead, state) => {
       res.write(helmetHead);
       res.write(`<script>window.__REACT_QUERY_STATE__=${serialize(state)}</script>`);
       res.write(beforeRoot);
     });
   });
   ```

   * Injection de `window.__ENV__` si défini (`VITE_BASE_URL_BACKEND`, `VITE_SERVER_URL`, `VITE_SLUG`) .
5. **Démarrage**

   ```js
   app.listen(process.env.PORT || 3000);
   ```

---

### 12.3 `src/entry-server.tsx`&#x20;

1. **Import des outils SSR**

   * `renderToPipeableStream` de React 18+
   * `HelmetProvider` pour `<title>` et `<meta>` dynamiques
   * `createStaticHandler/Router` de React Router pour loaders et actions
2. **Préparation du router**

   ```ts
   const handler  = createStaticHandler(buildRoutes(cfg));
   const context  = await handler.query(new Request(absUrl));
   if (context instanceof Response) { /* redirection ou erreur */ }
   const router = createStaticRouter(handler.dataRoutes, context);
   ```
3. **Initialisation de React Query**

   ```ts
   const queryClient = new QueryClient({ defaultOptions:{ queries: { staleTime:60000 } } });
   await queryClient.ensureQueryData({ queryKey:["cocolight-init"], queryFn:()=>initApi(...) });
   const dehydratedState = dehydrate(queryClient, { shouldDehydrateQuery: q=>q.queryKey[0]!=="cocolight-init" });
   ```
4. **Streaming**

   ```ts
   const { pipe, abort } = renderToPipeableStream(
     <HelmetProvider context={helmetCtx}>
       <QueryClientProvider client={queryClient}>
         <HydrationBoundary state={dehydratedState}>
           <StaticRouterProvider .../>
         </HydrationBoundary>
       </QueryClientProvider>
     </HelmetProvider>,
     {
       bootstrapModules:['/src/entry-client.tsx'],
       onShellReady() { onHead(helmetHeadHtml, dehydratedState); pipe(res); },
       onAllReady() { res.write("</div></body></html>"); res.end(); },
       onShellError(err) { res.status(500).end('Erreur serveur'); }
     }
   );
   // Timeout et abort pour ne pas bloquer indéfiniment
   ```

   * `bootstrapModules` indique au client quel module charger pour hydrater.
   * `onHead` callback injecte `<title>`, `<meta>` et le script React Query.

---

### 12.4 `src/entry-client.tsx`&#x20;

1. **Initialisation i18n**

   ```ts
   import "@/i18n"; // init react-i18next via I18nBridge
   ```
2. **Récupération de la config et du state**

   ```ts
   const siteConfig = window.__CONFIG__ as SiteConfig;
   const dehydratedState = window.__REACT_QUERY_STATE__ ?? null;
   ```
3. **Création du router React**

   ```ts
   const router = createBrowserRouter(buildRoutes(siteConfig), { hydrationData: window.__staticRouterHydrationData });
   ```
4. **Hydratation React**

   ```tsx
   function Root() {
     const [queryClient] = useState(() => new QueryClient({ defaultOptions:{queries:{staleTime:60000}} }));
     return (
       <HelmetProvider>
         <QueryClientProvider client={queryClient}>
           <HydrationBoundary state={dehydratedState}>
             <RouterProvider router={router} />
           </HydrationBoundary>
         </QueryClientProvider>
       </HelmetProvider>
     );
   }
   hydrateRoot(document.getElementById("root")!, <Root />);
   ```

   * `HelmetProvider` pour relier les méta-données côté client.
   * `HydrationBoundary` reprend l’état React Query serveur sans refetch.

---

Avec ces quatre fichiers, SiteForge propose :

* Un **dev-server** ultra-rapide (HMR + SSR on‑the‑fly).
* Un **prod-server** optimisé (gzip, caching long, injection config/env, streaming SSR).
* Un **entry-server** robuste (React Router loaders, React Query prefetch, streaming avec Helmet).
* Un **entry-client** fluide (hydrateRoot, React Query, React Router hydratation).
