
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
  - [4.2 Flux d'exécution](#42-flux-dexécution)
    - [4.2.1 buildRoutes Synchrone vs Asynchrone](#421-buildroutes-synchrone-vs-asynchrone)
    - [4.2.2 Intégration des routes de modules](#422-intégration-des-routes-de-modules)
  - [4.3 Injection de la configuration et des ENV](#43-injection-de-la-configuration-et-des-env)
  - [4.4 Système de découverte de modules](#44-système-de-découverte-de-modules)
    - [4.4.1 Structure d'un module](#441-structure-dun-module)
    - [4.4.2 Configuration de module (`module.config.ts`)](#442-configuration-de-module-moduleconfigts)
    - [4.4.3 Auto-découverte avec `import.meta.glob`](#443-auto-découverte-avec-importmetaglob)
    - [4.4.4 Pattern factory de routes](#444-pattern-factory-de-routes)
    - [4.4.5 Chargement synchrone vs asynchrone](#445-chargement-synchrone-vs-asynchrone)
    - [4.4.6 Type discriminé `DiscoveredModule`](#446-type-discriminé-discoveredmodule)
    - [4.4.7 Guide : Créer un nouveau module](#447-guide--créer-un-nouveau-module)
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
    - [5.5.22 `search` (déprécié)](#5522-search-déprécié)
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
    - [Détails de `ListConfSchema`](#détails-de-listconfschema)
    - [Détails de `MapConfSchema`](#détails-de-mapconfschema)
    - [5.5.35 `searchProStatic`](#5535-searchprostatic)
    - [5.5.36 `hero-tiers-lieux`](#5536-hero-tiers-lieux)
    - [5.5.37 `title`](#5537-title)
    - [5.5.38 `content`](#5538-content)
    - [5.5.39 `filters`](#5539-filters)
    - [5.5.40 `gridLayout`](#5540-gridlayout)
    - [5.5.41 `news`](#5541-news)
  - [5.6 `FooterSchema`](#56-footerschema)
  - [5.7 `IntegrationsSchema`](#57-integrationsschema)
  - [5.8 `FeatureFlagSchema`](#58-featureflagschema)
  - [5.9 `ThemeConfigSchema`](#59-themeconfigschema)
  - [5.10 `PerformanceConfigSchema`](#510-performanceconfigschema)
  - [5.11 `AdvancedSiteConfig`](#511-advancedsiteconfig)
- [6. Sections dynamiques](#6-sections-dynamiques)
  - [6.1 Vue d'ensemble de `SectionRenderer.tsx`](#61-vue-densemble-de-sectionrenderertsx)
    - [Code actuel](#code-actuel)
  - [6.2 Propriétés communes à toutes les sections](#62-propriétés-communes-à-toutes-les-sections)
  - [6.3 Description rapide des principaux types de section](#63-description-rapide-des-principaux-types-de-section)
    - [Sections de contenu \& layout](#sections-de-contenu--layout)
    - [Sections de données \& commerce](#sections-de-données--commerce)
    - [Sections d'engagement](#sections-dengagement)
    - [Sections de formulaires](#sections-de-formulaires)
    - [Sections de liste \& événements](#sections-de-liste--événements)
    - [Sections de recherche \& carte (depuis modules)](#sections-de-recherche--carte-depuis-modules)
    - [Section news (depuis module news)](#section-news-depuis-module-news)
    - [Autres](#autres)
  - [6.4 Comment ajouter ou personnaliser une nouvelle section](#64-comment-ajouter-ou-personnaliser-une-nouvelle-section)
- [7. Modules fonctionnels](#7-modules-fonctionnels)
  - [7.1 Module Search (`src/modules/search`)](#71-module-search-srcmodulessearch)
    - [7.1.1 Architecture interne](#711-architecture-interne)
    - [7.1.2 Schéma de configuration (`schema.ts`)](#712-schéma-de-configuration-schemats)
    - [7.1.3 Context et hooks](#713-context-et-hooks)
    - [7.1.4 Composants clés](#714-composants-clés)
    - [7.1.5 Exemple de configuration JSON](#715-exemple-de-configuration-json)
  - [7.2 Module Profil (`src/modules/profil`)](#72-module-profil-srcmodulesprofil)
    - [7.2.1 Architecture interne](#721-architecture-interne)
    - [7.2.2 Configuration de module (`module.config.ts`)](#722-configuration-de-module-moduleconfigts)
    - [7.2.3 Routes dynamiques avec loader SSR](#723-routes-dynamiques-avec-loader-ssr)
    - [7.2.4 Context et Provider](#724-context-et-provider)
      - [ProfileEntityContext](#profileentitycontext)
      - [ProfileEntityProvider](#profileentityprovider)
    - [7.2.5 Hook useProfileEntity](#725-hook-useprofileentity)
    - [7.2.6 Hook useFormatProfileEntity](#726-hook-useformatprofileentity)
    - [7.2.7 Schéma de configuration (`schema.ts`)](#727-schéma-de-configuration-schemats)
    - [7.2.8 Sections de profil](#728-sections-de-profil)
    - [7.2.9 ProfileRenderer](#729-profilerenderer)
    - [7.2.10 ProfileSectionRenderer](#7210-profilesectionrenderer)
    - [7.2.11 SEO dynamique (ProfileSeo)](#7211-seo-dynamique-profileseo)
    - [7.2.12 i18n et traductions](#7212-i18n-et-traductions)
    - [7.2.13 Configuration JSON dans site-config.json](#7213-configuration-json-dans-site-configjson)
    - [7.2.14 Flux d'exécution complet](#7214-flux-dexécution-complet)
  - [7.3 Module News (`src/modules/news`)](#73-module-news-srcmodulesnews)
    - [7.3.1 Architecture interne](#731-architecture-interne)
    - [7.3.2 Schéma de configuration (`schema.ts`)](#732-schéma-de-configuration-schemats)
    - [7.3.3 Hooks principaux](#733-hooks-principaux)
    - [7.3.4 Exemple de configuration JSON](#734-exemple-de-configuration-json)
    - [7.3.5 Préchargement SSR](#735-préchargement-ssr)
  - [7.4 Récapitulatif des modules](#74-récapitulatif-des-modules)
  - [7.5 Système de permissions modulaire (`src/lib/permissions`)](#75-système-de-permissions-modulaire-srclibpermissions)
    - [7.5.1 Architecture](#751-architecture)
    - [7.5.2 Types de base](#752-types-de-base)
    - [7.5.3 Registre des calculateurs](#753-registre-des-calculateurs)
    - [7.5.4 Hook générique `usePermissions`](#754-hook-générique-usepermissions)
    - [7.5.5 Créer des permissions pour un module](#755-créer-des-permissions-pour-un-module)
    - [7.5.6 Permissions du module Profil](#756-permissions-du-module-profil)
    - [7.5.7 Permissions du module News](#757-permissions-du-module-news)
    - [7.5.8 Hook rétrocompatible `useUserPermissions`](#758-hook-rétrocompatible-useuserpermissions)
    - [7.5.9 Avantages de l'architecture modulaire](#759-avantages-de-larchitecture-modulaire)
- [8. API Client \& Authentification](#8-api-client--authentification)
  - [8.1 Initialisation de l'API - Pattern Singleton (`apiClient.ts`)](#81-initialisation-de-lapi---pattern-singleton-apiclientts)
    - [8.1.1 Architecture du singleton](#811-architecture-du-singleton)
    - [8.1.2 Fonction principale: `initApiClient()`](#812-fonction-principale-initapiclient)
    - [8.1.3 Token Storage Strategy selon l'environnement](#813-token-storage-strategy-selon-lenvironnement)
    - [8.1.4 Helpers pour accéder aux singletons](#814-helpers-pour-accéder-aux-singletons)
    - [8.1.5 Types et interfaces](#815-types-et-interfaces)
    - [8.1.6 Gestion du slug contextuel](#816-gestion-du-slug-contextuel)
    - [8.1.7 Sécurité et gestion d'erreurs](#817-sécurité-et-gestion-derreurs)
    - [8.1.8 Usage dans les loaders SSR](#818-usage-dans-les-loaders-ssr)
    - [8.1.9 Limitations et considérations](#819-limitations-et-considérations)
  - [8.2 Stratégies de stockage des tokens](#82-stratégies-de-stockage-des-tokens)
    - [8.2.1 Choix automatique selon l'environnement](#821-choix-automatique-selon-lenvironnement)
    - [8.2.2 MultiServerTokenStorageStrategy](#822-multiservertokenstoragestrategy)
    - [8.2.3 Sécurité des tokens](#823-sécurité-des-tokens)
    - [8.2.4 Refresh automatique des tokens](#824-refresh-automatique-des-tokens)
    - [8.2.5 Gestion des erreurs de refresh](#825-gestion-des-erreurs-de-refresh)
    - [8.2.6 Clear tokens (logout)](#826-clear-tokens-logout)
    - [8.2.7 Vérification de l'état de connexion](#827-vérification-de-létat-de-connexion)
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
  - [12.4 `src/entry-client.tsx` - Hydratation avec detection Sync/Async](#124-srcentry-clienttsx---hydratation-avec-detection-syncasync)
    - [12.4.1 Déclarations globales TypeScript](#1241-déclarations-globales-typescript)
    - [12.4.2 Récupération de la config et du state](#1242-récupération-de-la-config-et-du-state)
    - [12.4.3 BuildRoutes avec détection Sync/Async](#1243-buildroutes-avec-détection-syncasync)
    - [12.4.4 Composant Root avec gestion Sync/Async](#1244-composant-root-avec-gestion-syncasync)
    - [12.4.5 Avantage de ce pattern](#1245-avantage-de-ce-pattern)
    - [12.4.6 Hydratation React Query](#1246-hydratation-react-query)
    - [12.4.7 Hydratation Helmet (meta tags)](#1247-hydratation-helmet-meta-tags)
    - [12.4.8 Point d'entrée final](#1248-point-dentrée-final)
    - [12.4.9 Initialisation i18n](#1249-initialisation-i18n)
  - [12.5 Pattern SSR Loader - Pre-fetching des données](#125-pattern-ssr-loader---pre-fetching-des-données)
    - [12.5.1 Principe du SSR Loader](#1251-principe-du-ssr-loader)
    - [12.5.2 Anatomie d'un loader](#1252-anatomie-dun-loader)
    - [12.5.3 Détection côté serveur vs client](#1253-détection-côté-serveur-vs-client)
    - [12.5.4 Utilisation de ensureQueryData](#1254-utilisation-de-ensurequerydata)
    - [12.5.5 Gestion des erreurs dans les loaders](#1255-gestion-des-erreurs-dans-les-loaders)
    - [12.5.6 Désérialisation de l'état React Query](#1256-désérialisation-de-létat-react-query)
    - [12.5.7 Pattern avec initApi singleton](#1257-pattern-avec-initapi-singleton)
    - [12.5.8 Exemple complet: Module Profil](#1258-exemple-complet-module-profil)
    - [12.5.9 Optimisations avancées](#1259-optimisations-avancées)
    - [12.5.10 Limitations et considérations](#12510-limitations-et-considérations)


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

### 4.2 Flux d'exécution

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

#### 4.2.1 buildRoutes Synchrone vs Asynchrone

La fonction `buildRoutes` (dans `src/lib/buildRoutes.tsx`) retourne soit `RouteObject[]` (synchrone) soit `Promise<RouteObject[]>` (asynchrone) selon le contexte :

**Mode SYNCHRONE** (pas de queryClient + modules core uniquement) :
- Utilisé **côté client** après hydratation
- Appelle `getModuleRoutesSync(modules)` pour charger les routes immédiatement
- **Évite le flash de loading** lors de la navigation
- Les routes config JSON n'ont **pas de loaders** (pas de pré-chargement côté client)

```typescript
// src/lib/buildRoutes.tsx (lignes 155-187)
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

    const moduleRoutes = getModuleRoutesSync(modules);  // ← Synchrone !

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
// src/lib/buildRoutes.tsx (lignes 197-278)
async function buildRoutesAsync(
  cfg: SiteConfig,
  queryClient: QueryClient | undefined,
  modules: ReturnType<typeof discoverModules>
): Promise<RouteObject[]> {
  // Routes config avec loaders pour SearchPro
  const configRoutes = cfg.pages.map((p) => ({
    path: p.path,
    element: <SiteRenderer />,
    loader: async ({ request }: LoaderFunctionArgs) => {
      if (!queryClient) return null;

      // Détecter les sections searchPro ou searchProStatic
      const searchSections = p.sections.filter(
        (s: { type: string }) => s.type === 'searchPro' || s.type === 'searchProStatic'
      );

      // Pré-charger les résultats pour chaque section
      await Promise.all(
        searchSections.map(section =>
          prefetchSearchResults(queryClient, { /* params */ })
        )
      );

      return null;
    }
  }));

  const moduleRoutes = await getModuleRoutes(modules, queryClient);  // ← Asynchrone !

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

#### 4.2.2 Intégration des routes de modules

Les routes finales combinent trois sources :

1. **Routes config JSON** : Pages définies dans `config.prod.json`
2. **Routes des modules** : Découvertes automatiquement via `discoverModules()` (voir section 4.4)
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
  Côté client et SSR, la fonction `readEnv` cherche d'abord `window.__ENV__`, puis `process.env`, puis `import.meta.env`, assurant une cohérence entre développement et production.

---

### 4.4 Système de découverte de modules

SiteForge 2.0 introduit un **système de découverte automatique de modules** qui élimine le besoin d'enregistrer manuellement les routes. Les modules sont découverts via `import.meta.glob` de Vite, compatible SSR.

---

#### 4.4.1 Structure d'un module

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

#### 4.4.2 Configuration de module (`module.config.ts`)

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

#### 4.4.3 Auto-découverte avec `import.meta.glob`

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

#### 4.4.4 Pattern factory de routes

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

#### 4.4.5 Chargement synchrone vs asynchrone

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

#### 4.4.6 Type discriminé `DiscoveredModule`

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

#### 4.4.7 Guide : Créer un nouveau module

**Étape 1 : Créer la structure**

```bash
mkdir -p src/modules/mymodule/{components,hooks,contexts,i18n}
touch src/modules/mymodule/{module.config.ts,routes.tsx,schema.ts,index.ts}
touch src/modules/mymodule/i18n/{fr,en}.json
```

**Étape 2 : Définir la configuration** (optionnel)

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

**Étape 3 : Exporter les routes** (si le module a des routes)

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

**Étape 4 : Le module est automatiquement découvert !**

Au prochain démarrage, `discoverModules()` trouve et charge le module sans configuration supplémentaire.

**Étape 5 : Exporter les API publiques** (optionnel)

```typescript
// src/modules/mymodule/index.ts
export { routes } from "./routes";
export { MyPage } from "./components/MyPage";
export { useMyHook } from "./hooks/useMyHook";
```

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
    items: z.array(z.object({
      icon: z.string().optional(),
      image: z.string().optional(),
      title: LocalizedString,
      text: LocalizedString,
      href: z.string().optional(),
      target: z.enum(["_self", "_blank"]).optional(),
      location: LocalizedString.optional(),
      badges: z.array(z.object({
        icon: z.string(),
        label: z.string().optional()
      })).optional(),
      avatarIcon: z.string().optional(),
      avatarColor: z.string().optional(),
      date: z.string().optional(),
      eventTitle: LocalizedString.optional(),
      organizerName: LocalizedString.optional(),
      iconSvg: z.string().optional(),
      iconColor: z.string().optional(),
      iconImage: z.string().optional(),
      iconClipPath: z.string().optional(),
    })),
    columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]).default(3),
    layout: z.enum(["grid", "masonry", "carousel", "list"]).default("grid"),
    variant: z.enum(["default", "tiers-lieux", "event", "icon-card"]).default("default"),
    className: z.string().optional(),
    showHeader: z.boolean().default(false),
    headerTitle: LocalizedString.optional(),
    showResultCount: z.boolean().default(false),
    showViewToggle: z.boolean().default(false),
  })
});
```

| Propriété | Type | Description |
| --------- | ---- | ----------- |
| `items` | `array` | Liste des cartes à afficher |
| `columns` | `1-6` | Nombre de colonnes (défaut: 3) |
| `layout` | `"grid" \| "masonry" \| "carousel" \| "list"` | Mode d'affichage |
| `variant` | `"default" \| "tiers-lieux" \| "event" \| "icon-card"` | Variante visuelle |
| `showHeader` | `boolean` | Afficher l'en-tête de section |
| `headerTitle` | `LocalizedString?` | Titre de l'en-tête |
| `showResultCount` | `boolean` | Afficher le compteur de résultats |
| `showViewToggle` | `boolean` | Afficher le toggle de vue |

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
    items: z.array(z.object({
      quote: LocalizedString,
      author: LocalizedString,
      role: LocalizedString.optional(),
      avatar: z.string().optional()
    })),
    style: z.enum(["grid", "carousel", "ticker"]).default("carousel"),
    autoplay: z.boolean().default(true),
  })
});
```

| Propriété | Type | Description |
| --------- | ---- | ----------- |
| `items` | `array` | Liste des témoignages |
| `style` | `"grid" \| "carousel" \| "ticker"` | Mode d'affichage (ticker = défilement continu) |
| `autoplay` | `boolean` | Lecture automatique du carousel/ticker |

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
        avatar: z.string().optional()
      }).optional(),
      featuredImage: z.string().optional(),
      tags: z.array(LocalizedString).optional(),
      readTime: z.number().optional()
    })),
    layout: z.enum(["grid", "list", "masonry"]).default("grid"),
    columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]).default(3),
    pagination: z.boolean().default(true),
    postsPerPage: z.number().default(9)
  })
});
```

| Propriété | Type | Description |
| --------- | ---- | ----------- |
| `posts` | `array` | Liste des articles |
| `layout` | `"grid" \| "list" \| "masonry"` | Mode d'affichage |
| `columns` | `1-6` | Nombre de colonnes |
| `pagination` | `boolean` | Activer la pagination |
| `postsPerPage` | `number` | Articles par page |

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
    md: z.string(),                           // chemin .mdx ou contenu inline
    sourceType: z.enum(["file", "inline"]).default("file"),
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
      src: z.string(),
      alt: LocalizedString.optional(),
      caption: LocalizedString.optional()
    })),
    columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]).default(3),
    lightbox: z.boolean().default(true)
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
    provider: z.enum(["youtube", "vimeo", "local", "loom"]).default("youtube"),
    ratio: z.enum(["16/9", "4/3", "1/1", "9/16"]).default("16/9"),
    autoplay: z.boolean().optional(),
    controls: z.boolean().default(true),
    loop: z.boolean().default(false)
  })
});
```

| Propriété | Type | Description |
| --------- | ---- | ----------- |
| `src` | `string` | URL ou ID de la vidéo |
| `provider` | `"youtube" \| "vimeo" \| "local" \| "loom"` | Plateforme vidéo |
| `ratio` | `"16/9" \| "4/3" \| "1/1" \| "9/16"` | Format d'affichage |
| `autoplay` | `boolean?` | Lecture automatique |
| `controls` | `boolean` | Afficher les contrôles |
| `loop` | `boolean` | Lecture en boucle |

#### 5.5.15 `table`

```ts
export const TableSectionSchema = z.object({
  type: z.literal("table"),
  id: z.string().optional(),
  props: z.object({
    headers: z.array(LocalizedString),
    rows: z.array(z.array(LocalizedString)),
    sortable: z.boolean().default(true),
    pagination: z.boolean().default(false),
    perPage: z.number().int().default(10)
  })
});
```

#### 5.5.16 `chart`

```ts
export const ChartSectionSchema = z.object({
  type: z.literal("chart"),
  id: z.string().optional(),
  props: z.object({
    kind: z.enum(["line", "bar", "pie", "area", "radar"]),
    data: z.array(
      z.record(z.string(), z.union([z.number(), z.string()]))
    ),
    xKey: z.string(),
    yKeys: z.array(z.string()),
    stacked: z.boolean().optional(),
    legend: z.boolean().default(true)
  })
});
```

| Propriété | Type | Description |
| --------- | ---- | ----------- |
| `kind` | `"line" \| "bar" \| "pie" \| "area" \| "radar"` | Type de graphique |
| `data` | `array` | Données à afficher |
| `xKey` | `string` | Clé de l'axe X |
| `yKeys` | `string[]` | Clés des séries Y |
| `stacked` | `boolean?` | Graphique empilé (bar/area) |
| `legend` | `boolean` | Afficher la légende |

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
    platform: z.enum(["twitter", "instagram", "linkedin", "facebook"]),
    feedId: z.string(),
    limit: z.number().default(6),
    layout: z.enum(["grid", "carousel", "masonry"]).default("grid")
  })
});
```

| Propriété | Type | Description |
| --------- | ---- | ----------- |
| `platform` | `"twitter" \| "instagram" \| "linkedin" \| "facebook"` | Plateforme sociale |
| `feedId` | `string` | Identifiant du flux |
| `limit` | `number` | Nombre d'éléments à afficher (défaut: 6) |
| `layout` | `"grid" \| "carousel" \| "masonry"` | Mode d'affichage |

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
      endDate: z.string().optional(),
      location: LocalizedString.optional(),
      image: z.string().optional(),
      registrationUrl: z.string().optional(),
      price: z.string().optional(),
      tags: z.array(LocalizedString).optional()
    })),
    layout: z.enum(["list", "grid", "calendar"]).default("list"),
    showPastEvents: z.boolean().default(false)
  })
});
```

| Propriété | Type | Description |
| --------- | ---- | ----------- |
| `events` | `array` | Liste des événements |
| `layout` | `"list" \| "grid" \| "calendar"` | Mode d'affichage |
| `showPastEvents` | `boolean` | Afficher les événements passés |

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
      price: z.string().optional(),
      images: z.array(z.string()),
      features: z.array(LocalizedString).optional(),
      cta: z.object({
        label: LocalizedString,
        href: z.string()
      }).optional()
    })),
    layout: z.enum(["grid", "carousel", "featured"]).default("grid"),
    showPrices: z.boolean().default(true)
  })
});
```

| Propriété | Type | Description |
| --------- | ---- | ----------- |
| `products` | `array` | Liste des produits |
| `layout` | `"grid" \| "carousel" \| "featured"` | Mode d'affichage (featured = mise en avant) |
| `showPrices` | `boolean` | Afficher les prix |

#### 5.5.25 `cookieConsent`

```ts
export const CookieConsentSectionSchema = z.object({
  type: z.literal("cookieConsent"),
  id: z.string().optional(),
  props: z.object({
    message: LocalizedString,
    acceptLabel: LocalizedString,
    declineLabel: LocalizedString.optional(),
    settingsLabel: LocalizedString.optional(),
    policyUrl: z.string().optional(),
    position: z.enum(["bottom", "top", "bottom-left", "bottom-right"]).default("bottom"),
    categories: z.array(z.object({
      id: z.string(),
      label: LocalizedString,
      description: LocalizedString,
      required: z.boolean().default(false)
    })).optional()
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
    disableInfiniteScroll: z.boolean().optional(),
    showDetailedViewToggle: z.boolean().optional(),
    customHeader: z.object({
      title: LocalizedString.optional(),
      linkText: LocalizedString.optional(),
      linkHref: z.string().optional(),
      showMapButton: z.boolean().default(true),
    }).optional(),

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
| `disableInfiniteScroll` | `boolean?` | Désactiver le scroll infini |
| `showDetailedViewToggle` | `boolean?` | Afficher le bouton vue détaillée |
| `customHeader` | `object?` | Configuration de l'en-tête personnalisé |
| `filters` | `Record<string, TagsFilterSchema>?` | Filtres personnalisés (tags, catégories) |
| `baseParams` | `object?` | Paramètres de base pour la recherche avancée |
| `list` | `ListConfSchema?` | Configuration de l'affichage en liste |
| `map` | `MapConfSchema?` | Configuration de l'affichage sur la carte |

#### Détails de `ListConfSchema`

```ts
const ListConfSchema = z.object({
  columns: z.object({
    lg: z.number().int().min(1).max(6).optional(),
    md: z.number().int().min(1).max(6).optional(),
    sm: z.number().int().min(1).max(6).optional(),
    xl: z.number().int().min(1).max(6).optional(),
  }).partial().optional(),
  card: z.object({
    tagLimit:        z.number().int().min(1).max(50).optional(),
    showDescription: z.boolean().optional(),
    showAddress:     z.boolean().optional(),
    shareButton:     z.boolean().optional(),
    detailsMode:     z.enum(["drawer", "dialog"]).default("drawer"),
    type:            z.enum(["overlay", "default", "tiers-lieux", "event"]).default("default"),
    variant:         z.enum(["default", "tiers-lieux", "event"]).optional(),
  }).partial().optional(),
  preview: z.object({
    type: z.enum(["default"]).default("default"),
  }).partial().optional(),
}).partial();
```

* **`card.type`** : `overlay` (texte sur l'image), `default`, `tiers-lieux`, ou `event`.
* **`card.variant`** : variante visuelle de la carte (`default`, `tiers-lieux`, `event`).
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

#### 5.5.35 `searchProStatic`

Version statique de `searchPro` sans synchronisation URL, conçue pour afficher plusieurs recherches sur une même page.

```ts
import { SearchProStaticSectionSchema } from "@/modules/search/schema";
```

```ts
export const SearchProStaticSectionSchema = z.object({
  type: z.literal("searchProStatic"),
  id:   z.string().optional(),

  props: z.object({
    title: LocalizedString.optional(),
    description: LocalizedString.optional(),
    placeholder: LocalizedString.optional(),
    useFilter:   z.boolean().default(false),
    showMap:     z.boolean().default(false),
    enableMap: z.boolean().default(true),
    showActiveFiltersTypes: z.boolean().default(false),
    showActiveFiltersTags: z.boolean().default(false),
    disableInfiniteScroll: z.boolean().optional(),
    showDetailedViewToggle: z.boolean().optional(),
    customHeader: z.object({
      title: LocalizedString.optional(),
      linkText: LocalizedString.optional(),
      linkHref: z.string().optional(),
      showMapButton: z.boolean().default(true),
    }).optional(),

    filters: z.record(z.string(), TagsFilterSchema).optional(),
    baseParams: z.object({ /* même structure que searchPro */ }).optional(),
    list: ListConfSchema.optional(),
    map:  MapConfSchema.optional(),
  }),
});
```

**Différences avec `searchPro`** :
- **Pas de synchronisation URL** : les filtres ne modifient pas l'URL
- **Defaults différents** : `useFilter: false`, `showActiveFiltersTypes: false`, `showActiveFiltersTags: false`
- **Placeholder optionnel** : contrairement à `searchPro` où il est obligatoire
- **Idéal pour** : intégrer plusieurs recherches sur une même page sans conflits de query params

---

#### 5.5.36 `hero-tiers-lieux`

Hero spécialisé pour les sites Tiers-Lieux avec recherche intégrée.

```ts
export const HeroTiersLieuxSchema = z.object({
  type: z.literal("hero-tiers-lieux"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    backgroundImage: z.string().optional(),
    ctaButtons: z.array(z.object({
      label: LocalizedString,
      variant: z.enum(["default", "secondary"]).optional(),
    })).optional(),
    placeholder: LocalizedString.optional(),
    searchButtonText: LocalizedString.optional(),
  }),
});
```

| Propriété | Type | Description |
| --------- | ---- | ----------- |
| `headline` | `LocalizedString` | Titre principal |
| `subhead` | `LocalizedString?` | Sous-titre |
| `backgroundImage` | `string?` | Image de fond |
| `ctaButtons` | `array?` | Boutons d'action |
| `placeholder` | `LocalizedString?` | Placeholder du champ de recherche |
| `searchButtonText` | `LocalizedString?` | Texte du bouton de recherche |

---

#### 5.5.37 `title`

Section de titre centrée, idéale pour séparer les parties d'une page.

```ts
const TitleSectionSchema = z.object({
  type: z.literal("title"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString,
    subtitle: LocalizedString.optional(),
    className: z.string().optional(),
    align: z.enum(["left", "center", "right"]).default("center"),
    size: z.enum(["sm", "md", "lg", "xl"]).default("lg"),
  }),
});
```

| Propriété | Type | Description |
| --------- | ---- | ----------- |
| `title` | `LocalizedString` | Titre principal |
| `subtitle` | `LocalizedString?` | Sous-titre optionnel |
| `align` | `"left" \| "center" \| "right"` | Alignement du texte |
| `size` | `"sm" \| "md" \| "lg" \| "xl"` | Taille du titre |
| `className` | `string?` | Classes CSS additionnelles |

---

#### 5.5.38 `content`

Section de contenu riche avec image, texte, tags et liens.

```ts
const ContentSectionSchema = z.object({
  type: z.literal("content"),
  id: z.string().optional(),
  props: z.object({
    category: LocalizedString.optional(),
    title: LocalizedString,
    description: LocalizedString,
    tags: z.array(LocalizedString).optional(),
    image: z.string().optional(),
    imagePosition: z.enum(["left", "right"]).default("right"),
    links: z.array(z.object({
      label: LocalizedString,
      href: z.string(),
    })).optional(),
    iconCard: z.object({
      svg: z.string(),
    }).optional(),
    infoText: LocalizedString.optional(),
    decorativeElements: z.object({
      type: z.enum(["corner-icon", "colored-squares", "none"]),
    }).optional(),
    className: z.string().optional(),
    stats: z.array(z.object({
      value: z.string(),
      label: LocalizedString
    })).optional(),
  }),
});
```

| Propriété | Type | Description |
| --------- | ---- | ----------- |
| `category` | `LocalizedString?` | Catégorie affichée au-dessus du titre |
| `title` | `LocalizedString` | Titre de la section |
| `description` | `LocalizedString` | Description principale |
| `tags` | `LocalizedString[]?` | Liste de tags |
| `image` | `string?` | URL de l'image |
| `imagePosition` | `"left" \| "right"` | Position de l'image |
| `links` | `array?` | Liens vers d'autres pages |
| `iconCard` | `object?` | Carte avec icône SVG |
| `stats` | `array?` | Statistiques à afficher |

---

#### 5.5.39 `filters`

Section de filtres avec groupes dépliables.

```ts
const FiltersSectionSchema = z.object({
  type: z.literal("filters"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString.optional(),
    filterGroups: z.array(z.object({
      id: z.string(),
      label: LocalizedString,
      options: z.array(z.object({
        id: z.string(),
        label: LocalizedString,
        name: z.string().optional(),
        defaultChecked: z.boolean().optional(),
      })),
    })),
    defaultOpenGroups: z.array(z.string()).optional(),
    className: z.string().optional(),
  }),
});
```

| Propriété | Type | Description |
| --------- | ---- | ----------- |
| `title` | `LocalizedString?` | Titre de la section filtres |
| `filterGroups` | `array` | Groupes de filtres |
| `defaultOpenGroups` | `string[]?` | IDs des groupes ouverts par défaut |

---

#### 5.5.40 `gridLayout`

Layout en grille avec deux colonnes configurable.

```ts
const GridLayoutSectionSchema = z.object({
  type: z.literal("gridLayout"),
  id: z.string().optional(),
  props: z.object({
    leftSection: z.any(),
    rightSection: z.any(),
    leftColumns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
    rightColumns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
    gap: z.number().optional(),
    className: z.string().optional(),
  }),
});
```

| Propriété | Type | Description |
| --------- | ---- | ----------- |
| `leftSection` | `Section` | Section à afficher à gauche |
| `rightSection` | `Section` | Section à afficher à droite |
| `leftColumns` | `1-4` | Nombre de colonnes pour la gauche |
| `rightColumns` | `1-4` | Nombre de colonnes pour la droite |
| `gap` | `number?` | Espacement entre les colonnes |

---

#### 5.5.41 `news`

Section de flux d'actualités avec commentaires et réactions.

```ts
import { NewsSectionSchema } from "@/modules/news/schema";
```

```ts
export const NewsSectionSchema = z.object({
  type: z.literal("news"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString.optional(),
    entitySlug: z.string().optional(),
    maxItems: z.number().positive().optional().default(10),
    showAddButton: z.boolean().optional().default(true),
    showFilters: z.boolean().optional().default(false),
    showComments: z.boolean().optional().default(true),
    showReactions: z.boolean().optional().default(true),
  }),
});
```

| Propriété | Type | Description |
| --------- | ---- | ----------- |
| `title` | `LocalizedString?` | Titre de la section |
| `entitySlug` | `string?` | Slug de l'entité pour filtrer les news |
| `maxItems` | `number` | Nombre maximum d'éléments à afficher |
| `showAddButton` | `boolean` | Afficher le bouton d'ajout |
| `showFilters` | `boolean` | Afficher les filtres |
| `showComments` | `boolean` | Afficher les commentaires |
| `showReactions` | `boolean` | Afficher les réactions |

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

### 6.1 Vue d'ensemble de `SectionRenderer.tsx`

Le fichier `src/components/sections/SectionRenderer.tsx` centralise le rendu de toutes les sections. Son principe :

1. **Mapping** : il associe chaque `type` de section (ex. `"hero"`) à un composant React lazy-loaded.
2. **Lazy Loading** : utilise `lazy()` de **vite-preload** (pas `React.lazy`) pour tracer les chunks correctement.
3. **Suspense + ErrorBoundary** : gère le chargement asynchrone et les erreurs.
4. **Rendu** : injecte les `props` dans le composant avec fallbacks appropriés.

#### Code actuel

```tsx
import { Suspense } from "react";
import { lazy } from "vite-preload"; // Utiliser lazy de vite-preload pour tracer les chunks
import type { PreloadableComponent } from "react-lazy-with-preload";
import type { Section, SectionPropsMap } from "@/types/site";
import { ErrorBoundary } from "../layout/ErrorBoundary";

// vite-preload retourne PreloadableComponent au lieu de LazyExoticComponent
type LazySectionComponent<T extends Section['type']> =
  PreloadableComponent<
    React.ComponentType<{ id?: string; props: SectionPropsMap[T] }>
  >;

// Mapping « type » → Composant lazy-loaded
// Chaque entrée crée un CHUNK séparé (code‑splitting).
// IMPORTANT: Tous les composants doivent avoir un export default.
const LazySections: {
  [K in keyof SectionPropsMap]: LazySectionComponent<K>;
} = {
  hero: lazy(() => import("./HeroSection")),
  "hero-tiers-lieux": lazy(() => import("./HeroTiersLieux")),
  markdown: lazy(() => import("./MarkdownSection")),
  cards: lazy(() => import("./CardsSection")),
  gallery: lazy(() => import("./GallerySection")),
  // ... 41 types de sections au total
  searchPro: lazy(() => import("@/modules/search/SearchProSection")),
  searchProStatic: lazy(() => import("@/modules/search/SearchProStaticSection")),
  news: lazy(() => import("@/modules/news/components/sections/NewsSection")),
};

// Fallback skeleton pour les sections en cours de chargement
function SectionLoadingFallback({ id, type }: { id?: string; type: string }) {
  return (
    <section id={id} className="py-8 animate-pulse" data-loading-section={type}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-8 bg-muted/40 rounded-lg w-1/3 mb-4" />
        <div className="h-4 bg-muted/30 rounded w-2/3 mb-2" />
        <div className="h-4 bg-muted/30 rounded w-1/2" />
      </div>
    </section>
  );
}

export function SectionRenderer({ section }: { section: Section }) {
  const LazyComponent = LazySections[section.type];

  if (!LazyComponent) {
    console.warn(`[SectionRenderer] Unknown section type: "${section.type}"`);
    return (
      <section id={section.id} className="py-16 bg-muted/30 text-foreground">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">
            Section type "{section.type}" not implemented yet
          </p>
        </div>
      </section>
    );
  }

  return (
    <Suspense fallback={<SectionLoadingFallback id={section.id} type={section.type} />}>
      <ErrorBoundary context={`Section[type=${section.type}]`}>
        <LazyComponent id={section.id} props={section.props} />
      </ErrorBoundary>
    </Suspense>
  );
}
```

**Points clés** :
- **vite-preload** : remplace `React.lazy` pour un meilleur tracking des chunks SSR
- **ErrorBoundary** : isole les erreurs de rendu par section
- **SectionLoadingFallback** : skeleton animé pendant le chargement
- **Types stricts** : `SectionPropsMap` assure la cohérence des props

---

### 6.2 Propriétés communes à toutes les sections

Bien que chaque section possède son propre schéma Zod et ses props spécifiques, certaines conventions sont partagées :

* **`type`** : identifiant unique (string littéral).
* **`id`** (optionnel) : permet l’ancrage (`<section id={id}>`).
* **`props`** : objet validé contenant toutes les données nécessaires au composant.

Ces conventions garantissent que `SectionRenderer` peut traiter **toutes** les sections uniformément.

---

### 6.3 Description rapide des principaux types de section

Le système supporte actuellement **41 types de sections** :

#### Sections de contenu & layout

| Type               | Composant                | Usage principal                                                        |
| ------------------ | ------------------------ | ---------------------------------------------------------------------- |
| **hero**           | `HeroSection`            | Bandeau d'accueil avec titre, sous-titre, image de fond et boutons CTA |
| **hero-tiers-lieux** | `HeroTiersLieux`       | Hero spécialisé pour Tiers-Lieux avec recherche intégrée               |
| **cards**          | `CardsSection`           | Grille de cartes (grid/masonry/carousel/list)                          |
| **content**        | `ContentSection`         | Bloc de contenu riche avec image, texte, tags et liens                 |
| **title**          | `TitleSection`           | Titre centré pour séparer les parties d'une page                       |
| **markdown**       | `MarkdownSection`        | Contenu Markdown/MDX                                                   |
| **gallery**        | `GallerySection`         | Galerie d'images avec lightbox                                         |
| **video**          | `VideoSection`           | YouTube/Vimeo/Loom/local video                                         |
| **html**           | `HTMLSection`            | Injection HTML brut                                                    |
| **gridLayout**     | `GridLayoutSection`      | Layout en grille deux colonnes configurable                            |

#### Sections de données & commerce

| Type                 | Composant                  | Usage principal                                   |
| -------------------- | -------------------------- | ------------------------------------------------- |
| **pricing**          | `PricingSection`           | Présentation des offres et tarifs                 |
| **stats**            | `StatsSection`             | Affichage chiffré (valeurs, icônes, animation)    |
| **table**            | `TableSection`             | Tableau de données sortable/paginable             |
| **chart**            | `ChartSection`             | Visualisation Recharts (line/bar/pie/area/radar)  |
| **productShowcase**  | `ProductShowcaseSection`   | Présentation de produits                          |
| **comparison**       | `ComparisonSection`        | Comparaison avant/après d'images                  |
| **featureComparison**| `FeatureComparisonSection` | Tableau comparatif de features                    |

#### Sections d'engagement

| Type             | Composant              | Usage principal                              |
| ---------------- | ---------------------- | -------------------------------------------- |
| **testimonials** | `TestimonialsSection`  | Témoignages clients (grid/carousel/ticker)   |
| **faq**          | `FAQSection`           | Questions/réponses accordéon                 |
| **accordion**    | `AccordionSection`     | Accordéon personnalisé (distinct de FAQ)     |
| **tabs**         | `TabsSection`          | Contenu à onglets (support sections imbriquées) |
| **steps**        | `StepsSection`         | Étapes/progression                           |
| **timeline**     | `TimelineSection`      | Chronologie d'événements                     |
| **team**         | `TeamSection`          | Présentation des membres d'équipe            |
| **cta**          | `CTASection`           | Appel à l'action avec boutons                |
| **banner**       | `BannerSection`        | Bandeau d'annonce (info/warning/error)       |
| **logoCloud**    | `LogoCloudSection`     | Logos partenaires/clients                    |
| **breadcrumb**   | `BreadcrumbSection`    | Navigation fil d'Ariane                      |

#### Sections de formulaires

| Type                   | Composant                    | Usage principal                    |
| ---------------------- | ---------------------------- | ---------------------------------- |
| **contactForm**        | `ContactFormSection`         | Formulaire de contact configurable |
| **loginForm**          | `LoginFormSection`           | Formulaire de connexion            |
| **registerForm**       | `RegisterFormSection`        | Formulaire d'inscription           |
| **recoverPasswordForm**| `RecoverPasswordFormSection` | Récupération de mot de passe       |
| **newsletter**         | `NewsletterSection`          | Inscription newsletter             |

#### Sections de liste & événements

| Type          | Composant           | Usage principal                         |
| ------------- | ------------------- | --------------------------------------- |
| **blogPost**  | `BlogPostSection`   | Article de blog individuel              |
| **blogList**  | `BlogListSection`   | Liste/grille d'articles                 |
| **eventList** | `EventListSection`  | Liste/grille/calendrier d'événements    |
| **socialFeed**| `SocialFeedSection` | Widget flux réseaux sociaux             |

#### Sections de recherche & carte (depuis modules)

| Type              | Composant                  | Usage principal                                         |
| ----------------- | -------------------------- | ------------------------------------------------------- |
| **searchPro**     | `SearchProSection`         | Recherche avancée avec filtres, carte et liste          |
| **searchProStatic** | `SearchProStaticSection` | Recherche statique (pas de sync URL, multi-instances)   |
| **map**           | `MapSection`               | Carte interactive (Leaflet/Google/Mapbox)               |
| **filters**       | `FiltersSection`           | Groupes de filtres dépliables                           |

#### Section news (depuis module news)

| Type     | Composant      | Usage principal                              |
| -------- | -------------- | -------------------------------------------- |
| **news** | `NewsSection`  | Flux d'actualités avec commentaires/réactions |

#### Autres

| Type              | Composant              | Usage principal                  |
| ----------------- | ---------------------- | -------------------------------- |
| **cookieConsent** | `CookieConsentSection` | Bandeau de consentement cookies  |

Chaque composant se trouve dans `src/components/sections/<Type>Section.tsx` ou dans le module correspondant (ex: `@/modules/search/SearchProSection`) et lit ses props typés.

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
├── SearchPro.tsx              # Composant principal avec synchronisation URL
├── SearchProStatic.tsx        # Version sans synchronisation URL
├── SearchProSection.tsx       # Section wrapper pour SearchPro
├── SearchProStaticSection.tsx # Section wrapper pour SearchProStatic
├── components/
│   ├── ActiveFiltersBar.tsx   # Affichage des filtres actifs
│   ├── FilterDropdown.tsx     # Dropdown de sélection de filtres
│   ├── SearchCard.tsx         # Carte de résultat (dispatch vers variantes)
│   ├── SearchCardDetailed.tsx # Vue détaillée d'une carte
│   ├── SearchCardSkeleton.tsx # Skeleton pour chargement
│   ├── SearchFilters.tsx      # Panneau de filtres
│   ├── SearchListView.tsx     # Liste des résultats
│   ├── SearchListSkeleton.tsx # Skeleton pour liste
│   ├── SearchMap.tsx          # Carte Leaflet
│   ├── SearchMapWrapper.tsx   # Wrapper avec lazy loading
│   ├── SearchTextInput.tsx    # Champ de recherche
│   ├── SwitchDetailsMode.tsx  # Switch drawer/dialog
│   ├── Preview.tsx            # Prévisualisation
│   ├── AddEntityModal.tsx     # Modal d'ajout d'entité
│   ├── renderMapPopup.tsx     # Rendu des popups carte
│   ├── card/
│   │   ├── CardDefault.tsx    # Carte standard
│   │   ├── CardOverlay.tsx    # Carte avec overlay
│   │   ├── CardTiersLieux.tsx # Carte tiers-lieux
│   │   └── CardEvent.tsx      # Carte événement
│   ├── detailsMode/
│   │   ├── DetailsModeDialog.tsx  # Modal détails
│   │   └── DetailsModeDrawer.tsx  # Drawer détails
│   ├── mapPopup/
│   │   └── MapPopupDefault.tsx    # Popup carte par défaut
│   └── preview/
│       └── PreviewDefault.tsx     # Prévisualisation par défaut
├── contexts/
│   ├── SearchPropsContext.tsx     # Context des props
│   └── SearchPropsProvider.tsx    # Provider du context
├── hooks/
│   ├── loadLeaflet.ts         # Chargement dynamique de Leaflet
│   ├── useItem.tsx            # Fusion données serveur/valeurs par défaut
│   ├── useSearchFilters.tsx   # Gestion des états de filtres
│   ├── useSearchQuery.ts      # Query pour résultats de recherche
│   └── useSearchProps.tsx     # Accès aux props du context
├── i18n/
│   ├── en.json                # Traductions anglaises
│   └── fr.json                # Traductions françaises
├── i18n.ts                    # Pont vers react-i18next
├── schema.ts                  # Schémas Zod (SearchProSectionSchema, SearchProStaticSectionSchema)
├── styles.css                 # Styles spécifiques au module
└── index.ts                   # Exports: SearchSection, SearchProSectionSchema
```

#### 7.1.2 Schéma de configuration (`schema.ts`)

Le module expose deux schémas principaux:

**`SearchProSectionSchema`** (voir section 5.5.34) - avec synchronisation URL:
* `title`, `description`: textes d'en-tête
* `placeholder`: texte du champ
* `useFilter`, `showMap`, `enableMap`: booléens d'activation
* `showActiveFiltersTypes`, `showActiveFiltersTags`: affichage des filtres actifs
* `disableInfiniteScroll`: désactiver le scroll infini
* `showDetailedViewToggle`: bouton toggle vue détaillée
* `customHeader`: en-tête personnalisé avec titre, lien et bouton carte
* `filters`: structure des filtres (tags, type)
* `baseParams`: paramètres initiaux (API, defaultTypes, defaultTags, defaultSortBy, etc.)
* `list`: configuration liste (colonnes, card type/variant, detailsMode, preview)
* `map`: configuration carte (initialZoom, cluster, popup type)

**`SearchProStaticSectionSchema`** (voir section 5.5.35) - sans synchronisation URL:
* Même structure mais avec des defaults différents (useFilter: false, showMap: false)
* Permet d'afficher plusieurs instances sur une même page sans conflit d'URL

#### 7.1.3 Context et hooks

* **`SearchPropsContext`** expose les props validées à tous les composants enfants (filtres, liste, carte).
* **`useSearchFilters`** gère l’état local des filtres (sélection, reset).
* **`loadLeaflet`** importe dynamiquement le bundle Leaflet uniquement si `showMap` est à `true` (optimisation du bundle).
* **`useItem`** fusionne les données serveur avec des valeurs par défaut et normalise la structure.

#### 7.1.4 Composants clés

| Composant              | Rôle                                                         |
| ---------------------- | ------------------------------------------------------------ |
| `SearchPro`            | Composant principal avec synchronisation URL (query params)  |
| `SearchProStatic`      | Version sans synchronisation URL (pour multi-instances)      |
| `SearchProSection`     | Section wrapper pour `SearchPro`                             |
| `SearchProStaticSection` | Section wrapper pour `SearchProStatic`                     |
| `ActiveFiltersBar`     | Affiche les filtres actifs avec boutons de suppression       |
| `FilterDropdown`       | Dropdown de sélection de filtres (tags, types)               |
| `SearchListView`       | Liste des résultats avec infinite scroll                     |
| `SearchMapWrapper`     | Wrapper avec lazy loading de Leaflet                         |
| `SearchMap`            | Carte Leaflet avec clusters et popups                        |
| `SearchCard`           | Carte individuelle (dispatch vers variantes)                 |
| `CardDefault`          | Variante carte standard                                      |
| `CardOverlay`          | Variante carte avec image en overlay                         |
| `CardTiersLieux`       | Variante carte tiers-lieux                                   |
| `CardEvent`            | Variante carte événement                                     |
| `SearchCardDetailed`   | Vue liste détaillée                                          |
| `SwitchDetailsMode`    | Ouvre les détails en `drawer` ou `dialog`                    |
| `DetailsModeDrawer`    | Drawer latéral pour détails                                  |
| `DetailsModeDialog`    | Modal dialog pour détails                                    |
| `PreviewDefault`       | Prévisualisation standard des informations                   |
| `MapPopupDefault`      | Popup par défaut pour les marqueurs de carte                 |
| `AddEntityModal`       | Modal d'ajout d'une nouvelle entité                          |

#### 7.1.5 Exemple de configuration JSON

**SearchPro** (avec synchronisation URL):
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
    "showDetailedViewToggle": true,
    "customHeader": {
      "title": { "fr": "Nos partenaires", "en": "Our partners" },
      "linkText": { "fr": "Voir tout", "en": "See all" },
      "linkHref": "/partners",
      "showMapButton": true
    },
    "filters": {
      "tags": {
        "type": "tags",
        "name": { "fr": "Thèmes", "en": "Topics" },
        "list": ["Culture", "Sport", "Environnement"],
        "active": true,
        "previewVisible": true
      },
      "types": {
        "type": "type",
        "name": { "fr": "Type", "en": "Type" },
        "list": {
          "organizations": { "fr": "Organisations", "en": "Organizations" },
          "projects": { "fr": "Projets", "en": "Projects" }
        }
      }
    },
    "baseParams": {
      "indexStepList": 12,
      "indexStepMap": 100,
      "defaultTypes": ["organizations", "projects"],
      "defaultTags": ["Culture"],
      "defaultSortBy": { "name": 1 }
    },
    "list": {
      "columns": { "lg": 3, "md": 2, "sm": 1 },
      "card": {
        "type": "tiers-lieux",
        "variant": "tiers-lieux",
        "detailsMode": "drawer",
        "showDescription": true,
        "showAddress": true,
        "tagLimit": 3
      },
      "preview": { "type": "default" }
    },
    "map": { "initialZoom": 10, "cluster": true, "popup": { "type": "default" } }
  }
}
```

**SearchProStatic** (sans synchronisation URL - pour multi-instances):
```json
{
  "type": "searchProStatic",
  "props": {
    "title": { "fr": "Événements à venir", "en": "Upcoming Events" },
    "placeholder": { "fr": "Rechercher un événement...", "en": "Search event..." },
    "useFilter": false,
    "showMap": false,
    "baseParams": {
      "defaultTypes": ["events"],
      "indexStepList": 6
    },
    "list": {
      "columns": { "lg": 3 },
      "card": { "type": "event", "variant": "event" }
    }
  }
}
```

---

### 7.2 Module Profil (`src/modules/profil`)

Le module **profil** gère l'affichage des pages de profil pour tous les types d'entités du système (organizations, events, projects, citoyens, poi). Il s'agit d'un **module core** (chargé en eager) pour éviter tout flash de loading lors de l'accès aux profils.

#### 7.2.1 Architecture interne

```
src/modules/profil/
├── actions/                        // Système d'actions refactorisé (config-driven)
│   ├── config/                     // Configurations des actions
│   │   ├── entityActionConfig.ts   // Config des actions d'entité (follow, join, etc.)
│   │   ├── memberActionConfig.ts   // Config des actions de membres
│   │   └── index.ts
│   ├── hooks/                      // Hooks d'actions par type d'entité
│   │   ├── useUserEntityActions.tsx
│   │   ├── useOrgEntityActions.tsx
│   │   ├── useProjectEntityActions.tsx
│   │   └── useEventEntityActions.tsx
│   ├── mutations/                  // Factories de mutations
│   │   ├── createEntityMutation.ts
│   │   └── createUserMutation.ts
│   └── builders/                   // Builders d'objets action
│       ├── buildEntityAction.tsx
│       └── buildUserAction.tsx
├── components/
│   ├── sections/
│   │   ├── ProfileHeader.tsx       // En-tête du profil (hero, simple, cover, minimal)
│   │   ├── ProfileInfo.tsx         // Informations générales (sidebar, inline, tabs)
│   │   ├── ProfileAbout.tsx        // Description et à propos
│   │   ├── ProfileMap.tsx          // Carte de localisation
│   │   ├── ProfileOrganizer.tsx    // Organisateur/Porteur de projet
│   │   ├── ProfileMembers.tsx      // Liste des membres
│   │   ├── ProfileGallery.tsx      // Galerie d'images
│   │   └── ProfileRelated.tsx      // Entités liées
│   └── templates/
│       └── ProfileTemplateDefault.tsx  // Template par défaut (complet)
├── contexts/
│   ├── ProfileEntityContext.tsx    // Context React pour l'entité du profil
│   └── ProfileEntityProvider.tsx   // Provider du context
├── hooks/
│   ├── useProfileEntity.tsx        // Hook pour accéder à l'entité typée
│   ├── useFormatProfileEntity.tsx  // Hook pour formater les données
│   └── useProfilPermissions.ts     // Hook local pour permissions profil (voir 7.5)
├── permissions/                    // Système de permissions modulaire (voir 7.5)
│   ├── types.ts                    // ProfilPermissions (48 champs)
│   ├── defaults.ts                 // DEFAULT_PROFIL_PERMISSIONS
│   ├── calculators/                // Calculateurs par type d'entité
│   │   ├── user.ts                 // calculateOwnProfilePermissions, calculateOtherUserPermissions
│   │   ├── organization.ts         // calculateOrganizationPermissions
│   │   ├── project.ts              // calculateProjectPermissions
│   │   ├── event.ts                // calculateEventPermissions
│   │   └── poi.ts                  // calculatePoiPermissions
│   ├── register.ts                 // Enregistrement namespace "profil"
│   └── index.ts                    // Exports
├── pages/
│   └── ProfilePage.tsx             // Page principale des profils
├── i18n/
│   ├── en.json                     // Traductions anglaises
│   └── fr.json                     // Traductions françaises
├── module.config.ts                // Configuration du module (type: "core")
├── routes.tsx                      // Routes dynamiques avec loader SSR
├── schema.ts                       // Schémas Zod des profils
├── ProfileRenderer.tsx             // Renderer principal de profil
├── ProfileSectionRenderer.tsx      // Renderer des sections
├── ProfileSeo.tsx                  // SEO dynamique
├── i18n.ts                         // Pont vers react-i18next
└── index.ts                        // Exports centralisés
```

#### 7.2.2 Configuration de module (`module.config.ts`)

```ts
const config: ModuleConfigSchema = {
  name: "profil",
  type: "core",          // Module core = chargé en eager (synchrone)
  enabled: true
};
```

Le module profil est **core** pour garantir qu'il est toujours disponible sans code-splitting, évitant ainsi tout flash de loading lors de l'accès à un profil.

#### 7.2.3 Routes dynamiques avec loader SSR

Le fichier `routes.tsx` exporte une fonction `routes` (de type `ModuleRouteFactory`) qui crée la route dynamique `/profil/:slug` avec génération automatique des sous-routes pour les tabs:

```ts
export const routes: ModuleRouteFactory = (
  queryClient?: QueryClient,
  config?: SiteConfig
): RouteObject[] => [
  {
    path: "profil/:slug",
    element: <ProfilePage />,
    loader: (args) => profileLoader(args, queryClient, config),
    children: generateTabRoutes(config),
  }
];
```

**Convention**: Les profils sont accessibles via `/profil/:slug`.

**Loader SSR intelligent** (`profileLoader`):
1. Pré-charge les données de l'entité via `entityBySlug(slug)`
2. Détecte le tab actif depuis l'URL (`/profil/:slug/news` → tab "news")
3. Pré-charge les données du tab si nécessaire (ex: news pour les types supportés)

```ts
const profileLoader = async (
  { params, request }: LoaderFunctionArgs,
  queryClient?: QueryClient,
  config?: SiteConfig
) => {
  if (!queryClient) return null; // Côté client, skip

  const slug = params.slug;
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const activeTab = pathSegments.length > 2 ? pathSegments[2] : 'about';

  // 1. Pré-charger l'entité
  const entity = await queryClient.ensureQueryData({
    queryKey: QUERY_KEYS.ELEMENT_ABOUT(slug),
    queryFn: () => initApi({ baseURL: getBaseUrl() }).then(({ entity }) =>
      entity.entityBySlug(slug)
    )
  });

  // 2. Pré-charger les données du tab actif (si news)
  if (entity && config?.profiles) {
    const tabConfig = config.profiles[entityType]?.tabs?.find(t => t.id === activeTab);
    if (tabConfig?.sections?.some(s => s.type === 'news')) {
      await prefetchNewsQuery(queryClient, entity);
    }
  }

  return { entity, activeTab };
};
```

**Génération dynamique des routes de tabs** (`generateTabRoutes`):
- Collecte tous les tabs configurés dans `config.profiles`
- Génère les routes enfants: `/profil/:slug/{tabId}`
- Support des sous-routes: `/profil/:slug/news/:newsId`

```ts
const generateTabRoutes = (config?: SiteConfig): RouteObject[] => {
  if (!config?.profiles) return [{ index: true, element: null }];

  const tabsMap = new Map<string, { subRoutes?: ProfileTabSubRoute[] }>();

  // Collecter tous les tabs de tous les types de profils
  Object.values(config.profiles).forEach(profileConfig => {
    profileConfig.tabs?.forEach(tab => {
      tabsMap.set(tab.id, { subRoutes: tab.subRoutes });
    });
  });

  // Générer les routes
  return [
    { index: true, element: null },
    ...Array.from(tabsMap.entries()).map(([tabId, data]) => ({
      path: tabId,
      element: null,
      children: data.subRoutes?.map(sub => ({
        path: sub.path,
        element: null,
      })),
    })),
  ];
};
```

#### 7.2.4 Context et Provider

##### ProfileEntityContext

Le context expose l'entité du profil, sa configuration et son type:

```ts
interface ProfileEntityContextType {
  entity: SearchEntity;      // Entité brute (union type)
  config: ProfileConfig;     // Configuration des sections
  entityType: ProfileType;   // Type: "organizations" | "events" | ...
}
```

##### ProfileEntityProvider

Le provider injecte ces valeurs dans le contexte:

```tsx
<ProfileEntityProvider
  entity={entity}
  config={profileConfig}
  entityType={entityType}
>
  <ProfileRenderer />
</ProfileEntityProvider>
```

#### 7.2.5 Hook useProfileEntity

Ce hook expose l'entité et sa configuration depuis le contexte:

```ts
export function useProfileEntity() {
  const context = useContext(ProfileEntityContext);
  if (!context) {
    throw new Error('useProfileEntity must be used within a ProfileEntityProvider');
  }
  return context;
}
```

**Usage**:

```tsx
function MyProfileComponent() {
  const { entity, config, entityType } = useProfileEntity();
  return <div>{entity.serverData?.name}</div>;
}
```

**Retourne**:
- `entity: SearchEntity` - L'entité brute du profil
- `config: ProfileConfig` - Configuration des sections et tabs
- `entityType: string` - Type d'entité ("organizations", "events", etc.)

#### 7.2.6 Hook useFormatProfileEntity

Ce hook formatte et normalise les données de l'entité pour l'affichage:

```ts
const {
  logoUrl,
  bannerUrl,
  address,
  organizer,
  name,
  tags,
  badges,
  membersCount,
  projectsCount,
  openingHours,
} = useFormatProfileEntity(entity);
```

#### 7.2.7 Schéma de configuration (`schema.ts`)

Le module profil utilise **Zod** pour valider la configuration des profils. La configuration principale est définie dans `site-config.json` sous la clé `profiles`:

```ts
// Types d'entités supportés
export const ProfileTypeSchema = z.enum([
  "events",
  "organizations",
  "projects",
  "citoyens",
  "poi"
]);

// Variantes de sections
export const ProfileHeaderVariantSchema = z.enum([
  "hero", "simple", "cover", "minimal", "banner-overlay", "complete"
]);
export const ProfileInfoVariantSchema = z.enum(["sidebar", "inline", "tabs"]);
export const ProfileLayoutVariantSchema = z.enum([
  "default", "modern", "compact", "full-width"
]);

// Schema pour les sous-routes d'un tab
export const ProfileTabSubRouteSchema = z.object({
  path: z.string(),           // ex: ":newsId" pour /profil/:slug/news/:newsId
  component: z.string(),      // ex: "NewsDetailPage"
  loader: z.string().optional(),
});

// Schema pour un tab de profil
export const ProfileTabSchema = z.object({
  id: z.string(),
  label: LocalizedString,
  path: z.string().optional(),    // chemin URL personnalisé (par défaut = id)
  sections: z.array(ProfileSectionSchema).optional(), // Option 1: sections composables
  component: z.enum(["SocialTab", "MembershipTab", "NewsTab"]).optional(), // Option 2: composant dédié
  subRoutes: z.array(ProfileTabSubRouteSchema).optional(), // Sous-routes (ex: news/:newsId)
  condition: ProfileTabConditionSchema, // Conditions d'affichage
}).refine(
  (data) => (data.sections && data.sections.length > 0) || data.component,
  { message: "Un tab doit avoir soit 'sections' soit 'component'" }
);

// Conditions d'affichage des tabs
export const ProfileTabConditionSchema = z.object({
  entityTypes: z.array(ProfileTypeSchema).optional(), // Types d'entités compatibles
  permissions: z.array(z.string()).optional(),         // Permissions requises
  userContext: z.enum(["own", "other", "any"]).optional(), // Contexte utilisateur
}).optional();

// Configuration d'un type de profil
export const ProfileConfigSchema = z.object({
  layout: ProfileLayoutVariantSchema.optional().default("default"),
  tabs: z.array(ProfileTabSchema).optional(),     // NOUVEAU: tabs configurables
  sections: z.array(ProfileSectionSchema),        // sections globales (hors tabs)
  hideHeader: z.boolean().optional().default(false),
  hideFooter: z.boolean().optional().default(false),
  seo: z.object({
    titleTemplate: z.string().optional(),
    descriptionTemplate: z.string().optional(),
  }).optional(),
});

// Configuration globale
export const ProfilesConfigSchema = z.object({
  default: ProfileConfigSchema.optional(),
  events: ProfileConfigSchema.optional(),
  organizations: ProfileConfigSchema.optional(),
  projects: ProfileConfigSchema.optional(),
  citoyens: ProfileConfigSchema.optional(),
  poi: ProfileConfigSchema.optional(),
}).optional();
```

#### 7.2.8 Sections de profil

Le module profil propose **15 types de sections** configurables:

| Section                    | Type                         | Variantes/Options                              | Description                               |
| -------------------------- | ---------------------------- | ---------------------------------------------- | ----------------------------------------- |
| `profile-header`           | ProfileHeaderSection         | hero, simple, cover, minimal, banner-overlay, complete | En-tête avec bannière et logo |
| `profile-info`             | ProfileInfoSection           | sidebar, inline, tabs                          | Informations générales et contact         |
| `profile-about`            | ProfileAboutSection          | layout: column, grid                           | Description et à propos                   |
| `profile-map`              | ProfileMapSection            | height, zoom, showMarker                       | Carte de localisation (Leaflet)           |
| `profile-organizer`        | ProfileOrganizerSection      | showLogo, showDescription, showLink            | Organisateur/Porteur de projet            |
| `profile-members`          | ProfileMembersSection        | limit, showRole, showManagement                | Liste des membres                         |
| `profile-gallery`          | ProfileGallerySection        | columns, lightbox                              | Galerie d'images avec lightbox            |
| `profile-related`          | ProfileRelatedSection        | relationType, limit                            | Entités liées (projects, events, poi)     |
| `profile-actions`          | ProfileActionsSectionSchema  | showEditButton, showAddDropdown, layout        | Boutons d'action (éditer, ajouter, email) |
| `profile-event-dates`      | ProfileEventDatesSectionSchema | showType, dateFormat                         | Dates d'événement (start/end)             |
| `profile-badges`           | ProfileBadgesSectionSchema   | layout (grid, flex, list), maxDisplay          | Badges et certifications                  |
| `profile-tags`             | ProfileTagsSectionSchema     | maxDisplay, linkable, searchOnClick            | Tags et mots-clés                         |
| `profile-opening-hours`    | ProfileOpeningHoursSectionSchema | format (table, list, compact), showCurrentStatus | Horaires d'ouverture          |
| `profile-tab-layout`       | ProfileTabLayoutSectionSchema | leftSections, rightSections                   | Layout deux colonnes pour tabs            |
| `profile-template-dynamic` | ProfileTemplateDynamicSchema | —                                              | Template dynamique basé sur config        |

Chaque section a son propre schéma Zod avec des options configurables. Exemple pour `profile-header`:

```ts
export const ProfileHeaderSectionSchema = z.object({
  type: z.literal("profile-header"),
  variant: ProfileHeaderVariantSchema.optional().default("hero"),
  showBackButton: z.boolean().optional().default(true),
  showShareButton: z.boolean().optional().default(true),
  showEditButton: z.boolean().optional().default(false),
  showBanner: z.boolean().optional().default(true),
  showAvatar: z.boolean().optional().default(true),
  bannerHeight: z.string().optional().default("384px"),
  avatarSize: z.string().optional().default("160px"),
  avatarOverlap: z.boolean().optional().default(true),
  showLocation: z.boolean().optional().default(true),
  allowUpload: z.boolean().optional().default(true),
  showActions: z.boolean().optional().default(true),
  showAddDropdown: z.boolean().optional().default(true),
  addConfig: AddConfigSchema,
  addDropdownLabel: LocalizedString.optional(),
  showEmailButton: z.boolean().optional().default(true),
  showReservationButton: z.boolean().optional().default(false),
  showAllPhotosButton: z.boolean().optional().default(true),
});
```

#### 7.2.9 ProfileRenderer

Le `ProfileRenderer` est le composant principal qui:
1. Récupère la configuration via `useProfileEntity()`
2. Applique le layout configuré
3. Rend les sections via `ProfileSectionRenderer`

```tsx
export function ProfileRenderer() {
  const { config } = useProfileEntity();

  return (
    <div className={`profile-layout-${config.layout}`}>
      {config.sections.map((section, idx) => (
        <ProfileSectionRenderer key={idx} section={section} />
      ))}
    </div>
  );
}
```

#### 7.2.10 ProfileSectionRenderer

Le `ProfileSectionRenderer` utilise un mapping lazy-loaded pour chaque type de section:

```tsx
const LazySections = {
  "profile-header": lazyNamed(() => import("./sections/ProfileHeader"), "ProfileHeader"),
  "profile-info": lazyNamed(() => import("./sections/ProfileInfo"), "ProfileInfo"),
  "profile-about": lazyNamed(() => import("./sections/ProfileAbout"), "ProfileAbout"),
  // ... etc
};

export function ProfileSectionRenderer({ section }) {
  const Component = LazySections[section.type];
  if (!Component) return null;

  return (
    <Suspense fallback={<ProfileSectionSkeleton />}>
      <Component {...section} />
    </Suspense>
  );
}
```

#### 7.2.11 SEO dynamique (ProfileSeo)

Le composant `ProfileSeo` génère les meta tags dynamiquement:

```tsx
<ProfileSeo
  entity={entity}
  isLoading={false}
  entityType={entityType}
/>
```

Il génère:
- `<title>` avec template configurable
- `<meta name="description">` avec template configurable
- Open Graph tags (og:title, og:description, og:image, og:type)
- Twitter Card tags
- Données structurées JSON-LD (Organization, Event, Person, Place)

#### 7.2.12 i18n et traductions

Le module profil gère ses propres traductions:

```ts
// i18n.ts
import i18n from "@/lib/i18n";
import enTranslations from "./i18n/en.json";
import frTranslations from "./i18n/fr.json";

i18n.addResourceBundle("en", "modules/profil", enTranslations);
i18n.addResourceBundle("fr", "modules/profil", frTranslations);
```

Utilisation dans les composants:

```tsx
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";

function ProfilePage() {
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");

  return <h1>{t("ProfilePage.title")}</h1>;
}
```

#### 7.2.13 Configuration JSON dans site-config.json

Exemple de configuration des profils avec **tabs** dans `site-config.json`:

```json
{
  "profiles": {
    "default": {
      "layout": "default",
      "sections": [
        { "type": "profile-header", "variant": "complete" }
      ],
      "tabs": [
        {
          "id": "about",
          "label": { "fr": "À propos", "en": "About" },
          "sections": [
            { "type": "profile-about" },
            { "type": "profile-map", "zoom": 15 }
          ]
        },
        {
          "id": "news",
          "label": { "fr": "Actualités", "en": "News" },
          "sections": [
            { "type": "news", "props": { "maxItems": 20, "showAddButton": true } }
          ],
          "subRoutes": [
            { "path": ":newsId", "component": "NewsDetailPage" }
          ],
          "condition": {
            "entityTypes": ["organizations", "projects", "citoyens"]
          }
        },
        {
          "id": "members",
          "label": { "fr": "Membres", "en": "Members" },
          "component": "MembershipTab",
          "condition": {
            "entityTypes": ["organizations", "projects"]
          }
        }
      ],
      "hideHeader": false,
      "hideFooter": false
    },
    "organizations": {
      "layout": "modern",
      "sections": [
        { "type": "profile-header", "variant": "banner-overlay", "showAddDropdown": true }
      ],
      "tabs": [
        {
          "id": "about",
          "label": { "fr": "À propos", "en": "About" },
          "sections": [
            { "type": "profile-tab-layout",
              "leftSections": [{ "type": "profile-about" }],
              "rightSections": [{ "type": "profile-info" }]
            }
          ]
        },
        {
          "id": "social",
          "label": { "fr": "Réseau", "en": "Network" },
          "component": "SocialTab"
        }
      ],
      "seo": {
        "titleTemplate": "{name} - Organisation",
        "descriptionTemplate": "{shortDescription}"
      }
    },
    "events": {
      "layout": "default",
      "sections": [
        { "type": "profile-header", "variant": "cover" },
        { "type": "profile-event-dates", "showType": true }
      ],
      "tabs": [
        {
          "id": "about",
          "label": { "fr": "Détails", "en": "Details" },
          "sections": [
            { "type": "profile-about" },
            { "type": "profile-organizer" },
            { "type": "profile-map", "zoom": 15 }
          ]
        }
      ]
    }
  }
}
```

**Système de tabs**:
- Chaque tab génère une route: `/profil/:slug/{tabId}`
- Les sous-routes permettent des pages de détail: `/profil/:slug/news/:newsId`
- `condition` contrôle l'affichage selon le type d'entité ou les permissions

**Hiérarchie de configuration**:
1. Configuration spécifique au type (`organizations`, `events`, etc.)
2. Si absente, fallback sur `default`
3. Si `default` absente, configuration hardcodée dans ProfilePage

#### 7.2.14 Flux d'exécution complet

1. **URL**: Utilisateur accède à `/profil/mon-organisation`
2. **Route matching**: React Router match la route `profil/:slug` du module profil
3. **Loader SSR** (côté serveur uniquement):
   - Appel API `entityBySlug(slug)`
   - Détection du tab actif depuis l'URL
   - Pre-fetch des données de l'entité ET du tab actif (ex: news)
4. **ProfilePage**:
   - Détection du type d'entité via `entity.getEntityType()`
   - Récupération de la config profil depuis `siteConfig.profiles[type]`
   - Injection dans ProfileEntityProvider
5. **ProfileRenderer / ProfileTemplateDynamic**:
   - Récupération entity + config via `useProfileEntity()`
   - Rendu des sections globales et des tabs via React Router Outlet
6. **Sections individuelles**:
   - Accès à l'entité typée via `useProfileEntity()`
   - Utilisation des type guards si nécessaire
   - Formatage des données via `useFormatProfileEntity()`

---

### 7.3 Module News (`src/modules/news`)

Le module News gère l'affichage des actualités avec système de commentaires, réactions et partage.

> **Note importante** : Ce module ne définit **pas de routes** propres, il expose uniquement une section `news` utilisable dans les pages JSON.

#### 7.3.1 Architecture interne

```
src/modules/news/
├── schema.ts                 # NewsSectionSchema, NewsConfigSchema
├── types.ts                  # Types TypeScript dérivés
├── i18n.ts                   # Pont vers react-i18next
├── index.ts                  # Exports centralisés
├── components/
│   ├── sections/
│   │   └── NewsSection.tsx   # Section principale (exportée dans SectionRenderer)
│   ├── forms/
│   │   ├── AddNewsModal.tsx  # Modal d'ajout de news
│   │   ├── EditNewsModal.tsx # Modal d'édition
│   │   ├── NewsFormImageUpload.tsx
│   │   ├── NewsFormDocumentUpload.tsx
│   │   ├── FileUploadProgress.tsx
│   │   └── ImageCropDialog.tsx
│   ├── comment/
│   │   ├── NewsComments.tsx  # Liste des commentaires
│   │   ├── CommentInput.tsx  # Saisie de commentaire
│   │   ├── CommentItem.tsx   # Affichage d'un commentaire
│   │   └── DeleteCommentDialog.tsx
│   ├── interactions/
│   │   ├── NewsReactionPicker.tsx  # Sélecteur de réactions
│   │   ├── NewsReactionsModal.tsx  # Modal des réactions
│   │   └── NewsVoteDisplay.tsx     # Affichage des votes
│   ├── media/
│   │   ├── NewsImageGrid.tsx  # Grille d'images
│   │   └── NewsFileList.tsx   # Liste de fichiers joints
│   ├── mention/
│   │   ├── MentionInput.tsx       # Input avec mentions @user
│   │   └── MentionSuggestions.tsx # Suggestions de mentions
│   ├── NewsItem.tsx           # Élément de news individuel
│   ├── NewsContent.tsx        # Contenu d'une news
│   ├── NewsDetailPage.tsx     # Vue détaillée d'une news
│   ├── DeleteNewsDialog.tsx   # Dialog de suppression
│   ├── ReportDialog.tsx       # Dialog de signalement
│   └── ShareNewsDialog.tsx    # Dialog de partage
├── hooks/
│   ├── useNewsQuery.tsx       # Query pour liste de news
│   ├── useNewsByIdQuery.tsx   # Query pour une news par ID
│   ├── useNewsMutations.tsx   # Mutations CRUD news
│   ├── useNewsVotes.tsx       # Gestion des votes/réactions
│   ├── useNewsCommentsQuery.tsx   # Query pour commentaires
│   ├── useCommentMutations.tsx    # Mutations CRUD commentaires
│   ├── useFormatNews.tsx      # Formatage des données news
│   ├── useFormatComment.tsx   # Formatage des commentaires
│   ├── useNewsEntity.tsx      # Accès à l'entité news
│   ├── useNewsContext.tsx     # Accès au contexte news
│   └── useNewsPermissions.ts  # Hook local pour permissions news (voir 7.5)
├── permissions/              # Système de permissions modulaire (voir 7.5)
│   ├── types.ts              # NewsPermissions (6 champs)
│   ├── defaults.ts           # DEFAULT_NEWS_PERMISSIONS
│   ├── calculators/
│   │   └── news.ts           # calculateNewsPermissions
│   ├── register.ts           # Enregistrement namespace "news"
│   └── index.ts              # Exports
├── contexts/
│   ├── NewsContext.tsx        # Contexte React
│   ├── NewsProvider.tsx       # Provider du contexte
│   └── index.ts
├── prefetch/
│   ├── prefetchNews.ts        # Préchargement SSR des news
│   └── index.ts
├── constants/
│   ├── queryKeys.ts           # Clés React Query
│   ├── voteTypes.ts           # Types de votes/réactions
│   ├── reportReasons.ts       # Raisons de signalement
│   ├── supportedTypes.ts      # Types d'entités supportés
│   └── index.ts
└── utils/
    ├── commentCacheUtils.ts   # Utilitaires cache commentaires
    └── index.ts
```

#### 7.3.2 Schéma de configuration (`schema.ts`)

```ts
// Section News pour affichage dans les pages
export const NewsSectionSchema = z.object({
  type: z.literal("news"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString.optional(),
    entitySlug: z.string().optional(),        // Filtrer par entité
    maxItems: z.number().positive().optional().default(10),
    showAddButton: z.boolean().optional().default(true),
    showFilters: z.boolean().optional().default(false),
    showComments: z.boolean().optional().default(true),
    showReactions: z.boolean().optional().default(true),
  }),
});

// Configuration globale du module
export const NewsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxFileSize: z.number().positive().default(10 * 1024 * 1024), // 10MB
  allowedFileTypes: z.array(z.string()).default(["image/jpeg", "image/png", "image/webp"]),
  maxImages: z.number().positive().default(5),
  maxTextLength: z.number().positive().default(2000),
  enableReactions: z.boolean().default(true),
  enableComments: z.boolean().default(true),
  enableSharing: z.boolean().default(true),
  moderationEnabled: z.boolean().default(false),
});
```

#### 7.3.3 Hooks principaux

```ts
// Liste des news avec pagination infinie (timestamp-based)
const {
  news,              // News[] transformées en instances Proxy
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  lastItemRef,       // Ref pour infinite scroll
  error,
  refetch
} = useNewsQuery({
  entity,            // EntityTypes - l'entité parente
  entityType,        // string - "organizations" | "projects" | "citoyens"
  enabled: true,     // boolean - activer/désactiver la query
  indexStep: 12      // number - items par page
});

// News par ID
const { data: news, isLoading } = useNewsByIdQuery(newsId);

// Accès à l'entité depuis le contexte
const entity = useNewsEntity(); // EntityTypes

// Mutations CRUD
const { createNews, updateNews, deleteNews } = useNewsMutations();

// Votes et réactions
const { addVote, removeVote, hasVoted } = useNewsVotes(newsId);

// Commentaires
const { data: comments } = useNewsCommentsQuery(newsId);
const { addComment, deleteComment } = useCommentMutations();

// Context
const { entity, entityType } = useNewsContext();
const contextOrNull = useOptionalNewsContext(); // Version optionnelle
```

**Types d'entités supportés** (définies dans `constants/supportedTypes.ts`):
```ts
const NEWS_SUPPORTED_TYPES = new Set(["organizations", "projects", "citoyens"]);
```

#### 7.3.4 Exemple de configuration JSON

```json
{
  "type": "news",
  "id": "actualites",
  "props": {
    "title": { "fr": "Actualités", "en": "News" },
    "entitySlug": "my-organization",
    "maxItems": 15,
    "showAddButton": true,
    "showFilters": true,
    "showComments": true,
    "showReactions": true
  }
}
```

#### 7.3.5 Préchargement SSR

Le module supporte le préchargement SSR via `prefetchNewsQuery`:

```ts
import { prefetchNewsQuery } from "@/modules/news";

/**
 * Pré-charge les news d'une entité dans React Query
 * @param queryClient - Instance QueryClient
 * @param entity - Entité parente (EntityTypes)
 * @param indexStep - Nombre d'items par page (défaut: 12)
 */
export async function prefetchNewsQuery(
  queryClient: QueryClient,
  entity: EntityTypes,
  indexStep = 12
): Promise<void> {
  await queryClient.prefetchInfiniteQuery({
    queryKey: NEWS_QUERY_KEYS.NEWS(entity.id ?? null),
    queryFn: async () => entity.getNews({ indexStep }),
    initialPageParam: undefined,
  });
}
```

**Usage dans le loader du module profil** (routes.tsx):

```ts
// Le module profil pré-charge automatiquement les news si le tab actif contient une section news
if (tabConfig?.sections?.some(s => s.type === 'news') && NEWS_SUPPORTED_TYPES.has(entityType)) {
  await prefetchNewsQuery(queryClient, entity);
}
```

---

### 7.4 Récapitulatif des modules

| Module | Type | Routes | Usage |
|--------|------|--------|-------|
| **profil** | `core` | Oui (`/profil/:slug` + tabs dynamiques) | Affichage profils entités (orga/projet/user/poi/event) |
| **search** | - | Non | Sections `searchPro` et `searchProStatic` |
| **news** | - | Non | Section `news` avec commentaires et réactions |

> **Note** : `eventList`, `contactForm`, `blogList`, `newsletter` sont des **types de sections** (voir section 5.5), pas des modules avec leur propre structure.

Tous les modules suivent la même structure :
1. **Validation des props** avec Zod (`schema.ts`)
2. **Context/Hooks** pour la logique métier
3. **Composants** pour l'UI
4. **i18n** pour textes multi-langues
5. **Configuration** via `module.config.ts` (si routes)
6. **Routes** via `routes.tsx` (si nécessaire)
7. **Permissions** via `permissions/` (si le module gère des permissions)

---

### 7.5 Système de permissions modulaire (`src/lib/permissions`)

Le système de permissions de SiteForge est conçu pour être **extensible par module**. Chaque module peut enregistrer ses propres calculateurs de permissions sans modifier le code central.

#### 7.5.1 Architecture

```
src/lib/permissions/
├── types.ts           # Interfaces PermissionContext, PermissionCalculator
├── registry.ts        # Registre central (Map) des calculateurs
├── usePermissions.ts  # Hook générique pour calculer les permissions
└── index.ts           # Exports publics
```

**Principe** : Chaque module enregistre un calculateur dans un **registre central** via `registerPermissions()`. Le hook `usePermissions()` agrège les résultats des calculateurs demandés.

#### 7.5.2 Types de base

```ts
// src/lib/permissions/types.ts
import type { EntityTypes, User } from "@communecter/cocolight-api-client";

/**
 * Contexte passé aux calculateurs de permissions
 */
export interface PermissionContext {
  entity: EntityTypes | null;  // Entité concernée
  me: User | null;             // Utilisateur connecté
  data?: Record<string, unknown>; // Données additionnelles (news, etc.)
}

/**
 * Interface pour un calculateur de permissions
 */
export interface PermissionCalculator<T = Record<string, unknown>> {
  namespace: string;           // ex: "profil", "news"
  calculate: (context: PermissionContext) => T;
}
```

#### 7.5.3 Registre des calculateurs

```ts
// src/lib/permissions/registry.ts
const calculators = new Map<string, PermissionCalculator>();

/**
 * Enregistre un calculateur de permissions pour un module
 */
export function registerPermissions<T>(calculator: PermissionCalculator<T>): void {
  calculators.set(calculator.namespace, calculator);
}

export function getCalculator(namespace: string): PermissionCalculator | undefined {
  return calculators.get(namespace);
}

export function hasCalculator(namespace: string): boolean {
  return calculators.has(namespace);
}
```

#### 7.5.4 Hook générique `usePermissions`

```ts
// src/lib/permissions/usePermissions.ts
export function usePermissions<T extends Record<string, unknown>>(
  namespaces: string[],
  entity: EntityTypes | null,
  data?: Record<string, unknown>
): T {
  const { me } = useCocolight();

  return useMemo(() => {
    const context: PermissionContext = { entity, me, data };
    const result: Record<string, unknown> = {};

    for (const ns of namespaces) {
      const calculator = getCalculator(ns);
      if (calculator) {
        result[ns] = calculator.calculate(context);
      }
    }

    return result as T;
  }, [entity, me, data, namespaces]);
}
```

**Usage** :

```ts
// Demander plusieurs namespaces
const { profil, news } = usePermissions<{
  profil: ProfilPermissions;
  news: NewsPermissions;
}>(["profil", "news"], entity, { news: currentNews });

// Utiliser les permissions
if (profil.canEditProfile) { /* ... */ }
if (news.canAddNews) { /* ... */ }
```

#### 7.5.5 Créer des permissions pour un module

**Étape 1 : Définir les types**

```ts
// src/modules/mymodule/permissions/types.ts
export interface MyModulePermissions {
  canDoSomething: boolean;
  canDoOther: boolean;
}
```

**Étape 2 : Définir les valeurs par défaut**

```ts
// src/modules/mymodule/permissions/defaults.ts
export const DEFAULT_PERMISSIONS: MyModulePermissions = {
  canDoSomething: false,
  canDoOther: false,
};
```

**Étape 3 : Créer le(s) calculateur(s)**

```ts
// src/modules/mymodule/permissions/calculators/main.ts
import type { MyModulePermissions } from "../types";
import { DEFAULT_PERMISSIONS } from "../defaults";

export function calculateMyPermissions(entity: EntityTypes): MyModulePermissions {
  // Logique de calcul selon le type d'entité
  return {
    canDoSomething: entity.userContext?.isAdmin ?? false,
    canDoOther: true,
  };
}
```

**Étape 4 : Enregistrer dans le registre**

```ts
// src/modules/mymodule/permissions/register.ts
import { registerPermissions } from "@/lib/permissions";
import type { PermissionContext } from "@/lib/permissions";
import type { MyModulePermissions } from "./types";
import { DEFAULT_PERMISSIONS } from "./defaults";
import { calculateMyPermissions } from "./calculators/main";

function calculate(ctx: PermissionContext): MyModulePermissions {
  if (!ctx.entity?.isConnected || !ctx.me?.isConnected) {
    return DEFAULT_PERMISSIONS;
  }
  return calculateMyPermissions(ctx.entity);
}

// Enregistrement automatique à l'import
registerPermissions<MyModulePermissions>({
  namespace: "mymodule",
  calculate,
});
```

**Étape 5 : Créer un hook local (optionnel mais recommandé)**

```ts
// src/modules/mymodule/hooks/useMyModulePermissions.ts
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { usePermissions } from "@/lib/permissions";
import type { MyModulePermissions } from "../permissions";

// Déclenche l'enregistrement du calculateur
import "../permissions/register";

export function useMyModulePermissions(entity: EntityTypes | null): MyModulePermissions {
  const { mymodule } = usePermissions<{ mymodule: MyModulePermissions }>(
    ["mymodule"],
    entity
  );
  return mymodule;
}
```

#### 7.5.6 Permissions du module Profil

Le module profil enregistre le namespace `"profil"` avec **48 permissions** :

```
src/modules/profil/permissions/
├── types.ts              # ProfilPermissions (48 champs)
├── defaults.ts           # DEFAULT_PROFIL_PERMISSIONS
├── calculators/
│   ├── user.ts           # calculateOwnProfilePermissions, calculateOtherUserPermissions
│   ├── organization.ts   # calculateOrganizationPermissions
│   ├── project.ts        # calculateProjectPermissions
│   ├── event.ts          # calculateEventPermissions
│   └── poi.ts            # calculatePoiPermissions
├── register.ts           # Enregistrement "profil"
└── index.ts              # Exports
```

**Interface `ProfilPermissions`** :

| Catégorie | Permissions |
|-----------|------------|
| **Profil** | `canEditProfile`, `editProfileReason` |
| **Relations** | `canFollow`, `isFollowing`, `canSendFriendRequest`, `isFriend` |
| **Organisation** | `canRequestMembership`, `canRequestOrganizationAdmin`, `isMember` |
| **Projets** | `isContributor`, `canRequestContributor`, `canRequestProjectAdmin` |
| **Admin** | `isAdmin`, `canRequestPromotion` |
| **Événements** | `isAuthor`, `isParticipant`, `canParticipate` |
| **Invitations** | `isToBeValidated`, `isInviting`, `isInvitingAdmin`, `isAdminPending` |
| **Amis** | `hasSentFriendRequest`, `hasReceivedFriendRequest` |
| **Création** | `canAddOrganization`, `canAddProject`, `canAddEvent`, `canAddPoi` |

**Hook local** :

```ts
import { useProfilPermissions } from "@/modules/profil/hooks/useProfilPermissions";

const { canEditProfile, isAdmin, isMember } = useProfilPermissions(entity);
```

#### 7.5.7 Permissions du module News

Le module news enregistre le namespace `"news"` avec **6 permissions** :

```
src/modules/news/permissions/
├── types.ts              # NewsPermissions (6 champs)
├── defaults.ts           # DEFAULT_NEWS_PERMISSIONS
├── calculators/
│   └── news.ts           # calculateNewsPermissions
├── register.ts           # Enregistrement "news"
└── index.ts              # Exports
```

**Interface `NewsPermissions`** :

```ts
export interface NewsPermissions {
  canAddNews: boolean;       // Peut créer une news
  canEditNews: boolean;      // Peut éditer la news courante
  canDeleteNews: boolean;    // Peut supprimer la news courante
  canModerateNews: boolean;  // Peut modérer (admin)
  canEditComment: boolean;   // Peut éditer un commentaire
  canDeleteComment: boolean; // Peut supprimer un commentaire
}
```

**Hook local** :

```ts
import { useNewsPermissions } from "@/modules/news/hooks/useNewsPermissions";

const { canAddNews, canEditNews, canModerateNews } = useNewsPermissions(entity, news);
```

#### 7.5.8 Hook rétrocompatible `useUserPermissions`

Pour la rétrocompatibilité, le hook global `useUserPermissions` agrège **tous** les namespaces :

```ts
// src/hooks/useUserPermissions.tsx
import { usePermissions } from "@/lib/permissions";
import "@/modules/profil/permissions/register";
import "@/modules/news/permissions/register";

export type UserPermissions = ProfilPermissions & NewsPermissions;

export function useUserPermissions(
  entity: EntityTypes | null,
  news?: News | null
): UserPermissions {
  const permissions = usePermissions<{
    profil: ProfilPermissions;
    news: NewsPermissions;
  }>(["profil", "news"], entity, { news });

  // Flatten pour rétrocompatibilité
  return {
    ...permissions.profil,
    ...permissions.news,
  };
}
```

**Usage** :

```ts
// Ancien code (toujours fonctionnel)
const { canEditProfile, canAddNews } = useUserPermissions(entity);

// Nouveau code recommandé (plus performant)
const { canEditProfile } = useProfilPermissions(entity);
const { canAddNews } = useNewsPermissions(entity);
```

#### 7.5.9 Avantages de l'architecture modulaire

| Aspect | Avant | Après |
|--------|-------|-------|
| **Fichier principal** | 434 lignes monolithique | 63 lignes wrapper |
| **Ajouter un module** | Modifier `useUserPermissions` | Créer `permissions/` dans le module |
| **Ajouter un type d'entité** | Modifier `useUserPermissions` | Créer un calculateur |
| **Testabilité** | Difficile (tout couplé) | Facile (fonctions pures isolées) |
| **Couplage** | Fort (tout dans un fichier) | Faible (par module) |
| **Performance** | Calcule tout | Ne calcule que les namespaces demandés |

---

## 8. API Client & Authentification

Le client d’API et le système d’authentification de SiteForge reposent sur le package `@communecter/cocolight-api-client`, configuré et initialisé via un contexte React.

---

### 8.1 Initialisation de l'API - Pattern Singleton (`apiClient.ts`)

Le fichier `src/lib/apiClient.ts` implémente un **pattern singleton** pour l'API client. Ce pattern garantit qu'une seule instance du client API existe dans l'application, évitant les initialisations multiples coûteuses.

#### 8.1.1 Architecture du singleton

Le singleton gère plusieurs caches internes:

```ts
// Variables d'état internes (module-level)
let client: ApiClient | null = null;
let userApiInstance: UserApi | null = null;
let api: Api | null = null;
let cachedMe: User | null = null;
let cachedOrganization: Organization | null = null;
let cachedContextType: string | undefined = undefined;
let cachedContextId: string | undefined = undefined;
let cachedEntity: any = null;
let initialized = false;
let initPromise: Promise<InitApiResult> | null = null;
```

**Pourquoi ce pattern ?**
- **Performance**: L'initialisation de l'API est coûteuse (vérification de connexion, récupération du `me`, résolution du slug contextuel)
- **Cohérence**: Garantit que tous les composants utilisent la même instance
- **SSR-safe**: Supporte l'initialisation côté serveur et côté client
- **Race condition safe**: Utilise `initPromise` pour éviter les initialisations concurrentes

#### 8.1.2 Fonction principale: `initApiClient()`

```ts
export async function initApiClient(
  options: InitApiOptions = {},
): Promise<InitApiResult> {
  // 1. Si déjà initialisé, retourner le cache
  if (initialized) {
    return {
      client: client!,
      userApiInstance: userApiInstance!,
      api: api!,
      me: cachedMe,
      organization: cachedOrganization,
      contextType: cachedContextType,
      contextId: cachedContextId,
      entity: cachedEntity,
    };
  }

  // 2. Si initialisation en cours, retourner la promesse existante
  if (initPromise) return initPromise;

  // 3. Démarrer l'initialisation
  initPromise = (async (): Promise<InitApiResult> => {
    const isServer = typeof window === "undefined";

    // Choisir le storage selon l'environnement
    const tokenStorageStrategy = isServer
      ? await Cocolight.tokenStorageStrategy.createDefaultMultiServerTokenStorageStrategy("memory")
      : await Cocolight.tokenStorageStrategy.createDefaultMultiServerTokenStorageStrategy("localStorage");

    // Créer le client API
    client = new Cocolight.ApiClient({
      baseURL: options.baseURL ?? getBaseUrl(),
      debug: options.debug ?? false,
      ...options,
      tokenStorageStrategy,
    });

    // Créer l'instance UserApi
    userApiInstance = Cocolight.Api.userApi(client);
    initialized = true;

    // Initialiser les caches
    cachedMe = null;
    cachedOrganization = null;
    const slug = getSlug();

    try {
      // Si connecté, récupérer l'utilisateur
      if (userApiInstance.client.isConnected) {
        const loggedUser = await userApiInstance.meIsconnected();
        api = new Cocolight.Api(loggedUser, userApiInstance.client);
        cachedMe = await api.me();
      } else {
        api = new Cocolight.Api(null, userApiInstance.client);
      }

      // Résoudre le slug contextuel (si présent)
      if (slug) {
        const entity = cachedMe
          ? await cachedMe.entityBySlug(slug)
          : await api.entitySlug(slug);

        if (entity) {
          cachedEntity = entity;
          cachedContextType = entity.getEntityType();
          cachedContextId = entity.id || undefined;

          if (cachedContextType === "organizations") {
            cachedOrganization = entity as Organization;
          }
        }
      }
    } catch (err) {
      console.error("[Api.init] Erreur lors de l'initialisation:", err);
      if (!api) {
        api = new Cocolight.Api(null, userApiInstance.client);
      }
    }

    return {
      client,
      userApiInstance,
      api,
      me: cachedMe,
      organization: cachedOrganization,
      contextType: cachedContextType,
      contextId: cachedContextId,
      entity: cachedEntity,
    } as InitApiResult;
  })();

  return initPromise;
}
```

**Flux d'initialisation**:
1. **Vérification du cache** (`initialized`): Si déjà initialisé, retour immédiat
2. **Vérification de promesse concurrente** (`initPromise`): Évite les double initialisations
3. **Choix du storage**: `memory` (SSR) ou `localStorage` (client)
4. **Création du client API**: Instance `ApiClient` avec token storage
5. **Création de l'API façade**: Instance `UserApi` et `Api`
6. **Récupération du `me`**: Si connecté, appel `meIsconnected()` + `api.me()`
7. **Résolution du slug contextuel**: Si présent, résolution de l'entité via `entityBySlug(slug)`
8. **Cache de l'entité**: Stockage dans `cachedEntity`, `cachedOrganization`, etc.

#### 8.1.3 Token Storage Strategy selon l'environnement

Le choix du storage est automatique:

```ts
const isServer = typeof window === "undefined";

const tokenStorageStrategy = isServer
  ? await Cocolight.tokenStorageStrategy.createDefaultMultiServerTokenStorageStrategy("memory")
  : await Cocolight.tokenStorageStrategy.createDefaultMultiServerTokenStorageStrategy("localStorage");
```

- **Côté serveur** (`isServer = true`): Utilise `memory` (non persistant, évite les collisions entre requêtes)
- **Côté client** (`isServer = false`): Utilise `localStorage` (persistant entre sessions)

#### 8.1.4 Helpers pour accéder aux singletons

Le fichier expose des helpers pour accéder facilement aux instances:

```ts
// Retourne le client API (initialise si nécessaire)
export async function getApiClient(): Promise<ApiClient> {
  if (!initialized) await initApiClient();
  return client!;
}

// Retourne l'instance UserApi (initialise si nécessaire)
export async function getUserApi(): Promise<UserApi> {
  if (!initialized) await initApiClient();
  return userApiInstance!;
}

// Retourne l'API façade (initialise si nécessaire)
export async function getApi(): Promise<Api> {
  if (!initialized) await initApiClient();
  return api!;
}

// Alias simple pour initApiClient (retourne la promesse directement)
export function initApi(options: InitApiOptions = {}) {
  return initApiClient(options);
}
```

**Usage recommandé**:
- Utiliser `initApi()` pour forcer l'initialisation avec des options spécifiques
- Utiliser les helpers (`getApiClient()`, `getApi()`, etc.) pour un accès lazy

#### 8.1.5 Types et interfaces

```ts
export interface InitApiOptions {
  baseURL?: string;
  debug?: boolean;
  [key: string]: any; // Options supplémentaires du SDK
}

export interface InitApiResult {
  client: ApiClient;
  userApiInstance: UserApi;
  api: Api;
  me: User | null;
  organization: Organization | null;
  contextType?: string;     // Type de l'entité contextuelle ("organizations", "events", etc.)
  contextId?: string;       // ID de l'entité contextuelle
  entity?: any;             // L'entité complète (organization, project, event, etc.)
}
```

#### 8.1.6 Gestion du slug contextuel

Le slug contextuel provient de `getSlug()` (défini dans `src/lib/constant/common.ts`):

```ts
const slug = getSlug(); // Ex: "toulouse", "ma-startup"

if (slug) {
  const entity = cachedMe
    ? await cachedMe.entityBySlug(slug)  // Si connecté, utiliser me.entityBySlug
    : await api.entitySlug(slug);         // Sinon, utiliser l'API publique

  if (entity) {
    cachedEntity = entity;
    cachedContextType = entity.getEntityType();
    cachedContextId = entity.id;

    // Si c'est une organisation, la mettre en cache
    if (cachedContextType === "organizations") {
      cachedOrganization = entity as Organization;
    }
  }
}
```

**Contexte d'utilisation**: Permet d'avoir un "contexte" actif dans toute l'application (ex: l'organisation courante) accessible via le singleton.

#### 8.1.7 Sécurité et gestion d'erreurs

L'initialisation est entourée de try-catch pour garantir qu'une instance `Api` existe toujours:

```ts
try {
  // Initialisation normale
} catch (err) {
  console.error("[Api.init] Erreur lors de l'initialisation:", err);
  if (!api) {
    api = new Cocolight.Api(null, userApiInstance.client); // Fallback: API non connectée
  }
}
```

**Garantie**: Même en cas d'erreur réseau, l'application dispose d'une instance API fonctionnelle (non connectée).

#### 8.1.8 Usage dans les loaders SSR

Les loaders de routes utilisent `initApi()` pour initialiser l'API côté serveur:

```ts
// Dans routes.tsx du module profil
loader: async ({ params }) => {
  const { organization } = await initApi({
    baseURL: getBaseUrl(),
    debug: true
  });

  return await queryClient.ensureQueryData({
    queryKey: ["element-about", params.slug],
    queryFn: () => organization.entityBySlug(params.slug)
  });
}
```

**Avantage**: L'initialisation se fait une seule fois par requête SSR grâce au singleton.

#### 8.1.9 Limitations et considérations

**⚠️ Limitations du pattern singleton**:
- **SSR multi-requêtes**: Les variables module-level sont partagées entre toutes les requêtes SSR. En production, utiliser un système de requête-scoped context (ex: AsyncLocalStorage)
- **Reset impossible**: Une fois initialisé, le singleton ne peut pas être réinitialisé (par design)
- **Tests unitaires**: Nécessite un reset manuel entre tests

**✅ Avantages**:
- Évite les initialisations multiples coûteuses
- Garantit une seule source de vérité pour l'état de connexion
- Supporte SSR et CSR avec le même code
- Gestion automatique du storage selon l'environnement

---

### 8.2 Stratégies de stockage des tokens

Le stockage des tokens d'authentification est géré par le SDK `@communecter/cocolight-api-client` via sa factory `createDefaultMultiServerTokenStorageStrategy()`. Cette stratégie permet de gérer l'authentification sur plusieurs serveurs simultanément (multi-tenant).

#### 8.2.1 Choix automatique selon l'environnement

Le type de storage est choisi automatiquement dans `initApiClient()`:

```ts
const isServer = typeof window === "undefined";

const tokenStorageStrategy = isServer
  ? await Cocolight.tokenStorageStrategy.createDefaultMultiServerTokenStorageStrategy("memory")
  : await Cocolight.tokenStorageStrategy.createDefaultMultiServerTokenStorageStrategy("localStorage");
```

**Deux modes de storage**:

| Mode           | Environnement | Backend           | Persistance | Usage                                      |
| -------------- | ------------- | ----------------- | ----------- | ------------------------------------------ |
| `"memory"`     | Server (SSR)  | Map en mémoire    | Non         | SSR, évite collisions entre requêtes       |
| `"localStorage"` | Client (Browser) | `window.localStorage` | Oui   | Client, tokens persistés entre sessions    |

#### 8.2.2 MultiServerTokenStorageStrategy

Cette stratégie (fournie par le SDK) gère l'authentification multi-serveurs :

**Fonctionnalités**:
- Stocke les tokens **par serveur** (indexés par `origin`)
- Permet l'authentification **simultanée** sur plusieurs instances Communecter
- Gère automatiquement les **access tokens** et **refresh tokens**
- Switch automatique entre storage backends selon l'environnement

**API** (exposée par le SDK):
```ts
interface TokenStorageStrategy {
  get(serverUrl: string): Promise<TokenPair | null>;
  set(serverUrl: string, tokens: TokenPair): Promise<void>;
  clear(serverUrl: string): Promise<void>;
  clearAll(): Promise<void>;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
```

**Exemple de structure en localStorage**:

```json
{
  "cocolight_tokens_https://api1.communecter.org": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  },
  "cocolight_tokens_https://api2.communecter.org": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

#### 8.2.3 Sécurité des tokens

**Côté client (localStorage)**:
- Les tokens sont stockés dans `localStorage` avec un préfixe `cocolight_tokens_`
- **⚠️ Limitation**: `localStorage` est accessible par JavaScript, vulnérable aux attaques XSS
- **Recommandation**: Le SDK gère le refresh automatique des tokens expirés

**Côté serveur (memory)**:
- Les tokens sont stockés en mémoire (Map JavaScript)
- Non persistant : les tokens sont perdus à chaque redémarrage du serveur
- **⚠️ Limitation SSR**: Les variables module-level sont partagées entre toutes les requêtes
- **Recommandation future**: Utiliser AsyncLocalStorage pour isoler les tokens par requête

#### 8.2.4 Refresh automatique des tokens

Le SDK `@communecter/cocolight-api-client` gère automatiquement le refresh des tokens:

1. **Détection d'expiration**: Lors d'un appel API, si le `accessToken` est expiré (HTTP 401), le SDK déclenche automatiquement un refresh
2. **Refresh silencieux**: Utilise le `refreshToken` pour obtenir un nouveau `accessToken`
3. **Retry automatique**: Rejoue la requête initiale avec le nouveau token
4. **Mise à jour du storage**: Le nouveau `accessToken` est automatiquement stocké

**Avantage**: Les composants React n'ont pas besoin de gérer manuellement l'expiration des tokens.

#### 8.2.5 Gestion des erreurs de refresh

Si le `refreshToken` est également expiré:

1. Le SDK émet un événement `token-refresh-failed`
2. L'utilisateur est automatiquement déconnecté
3. Les tokens sont supprimés du storage
4. Redirection vers la page de login (si configurée)

**Gestion dans l'application**:

```ts
// Dans un provider React ou l'entrée de l'application
client.on('token-refresh-failed', () => {
  console.warn('Tokens expirés, déconnexion automatique');
  // Optionnel: Rediriger vers /login
  window.location.href = '/login';
});
```

#### 8.2.6 Clear tokens (logout)

Pour déconnecter un utilisateur et supprimer ses tokens:

```ts
import { getApiClient } from "@/lib/apiClient";

async function logout() {
  const client = await getApiClient();
  const baseURL = client.config.baseURL;

  // Supprimer les tokens du storage
  await client.tokenStorageStrategy.clear(baseURL);

  // Optionnel: Clear tous les tokens (multi-serveurs)
  await client.tokenStorageStrategy.clearAll();

  // Réinitialiser l'état de connexion
  window.location.href = '/';
}
```

#### 8.2.7 Vérification de l'état de connexion

Le SDK expose `client.isConnected` pour vérifier si l'utilisateur est authentifié:

```ts
const client = await getApiClient();

if (client.isConnected) {
  console.log('Utilisateur connecté');
  const me = await api.me();
} else {
  console.log('Utilisateur non connecté');
}
```

**Fonctionnement**:
- `isConnected` vérifie si un `accessToken` valide existe dans le storage
- Ne fait **pas** d'appel réseau (vérification locale uniquement)
- Peut être utilisé côté client pour afficher/masquer des éléments UI

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

Le rendu des sections utilise **`vite-preload`** (et non `React.lazy`) pour un meilleur tracking SSR des chunks :

```tsx
// src/components/sections/SectionRenderer.tsx
import { Suspense } from "react";
import { lazy } from "vite-preload"; // ← vite-preload pour SSR
import type { PreloadableComponent } from "react-lazy-with-preload";
import type { Section, SectionPropsMap } from "@/types/site";
import { ErrorBoundary } from "../layout/ErrorBoundary";

// Type pour les composants lazy avec préchargement
type LazySectionComponent<T extends Section['type']> =
  PreloadableComponent<
    React.ComponentType<{ id?: string; props: SectionPropsMap[T] }>
  >;

// Mapping « type » → Composant lazy-loaded
// IMPORTANT: Tous les composants doivent avoir un export default
const LazySections: {
  [K in keyof SectionPropsMap]: LazySectionComponent<K>;
} = {
  hero: lazy(() => import("./HeroSection")),
  "hero-tiers-lieux": lazy(() => import("./HeroTiersLieux")),
  cards: lazy(() => import("./CardsSection")),
  // ... 41 types de sections au total
  searchPro: lazy(() => import("@/modules/search/SearchProSection")),
  searchProStatic: lazy(() => import("@/modules/search/SearchProStaticSection")),
  news: lazy(() => import("@/modules/news/components/sections/NewsSection")),
};

// Skeleton animé pendant le chargement
function SectionLoadingFallback({ id, type }: { id?: string; type: string }) {
  return (
    <section id={id} className="py-8 animate-pulse" data-loading-section={type}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-8 bg-muted/40 rounded-lg w-1/3 mb-4" />
        <div className="h-4 bg-muted/30 rounded w-2/3 mb-2" />
        <div className="h-4 bg-muted/30 rounded w-1/2" />
      </div>
    </section>
  );
}

export function SectionRenderer({ section }: { section: Section }) {
  const LazyComponent = LazySections[section.type];
  if (!LazyComponent) return null;

  return (
    <Suspense fallback={<SectionLoadingFallback id={section.id} type={section.type} />}>
      <ErrorBoundary context={`Section[type=${section.type}]`}>
        <LazyComponent id={section.id} props={section.props} />
      </ErrorBoundary>
    </Suspense>
  );
}
```

**Avantages de vite-preload** :
* **Tracking SSR** : les chunks sont correctement tracés pour le préchargement côté serveur
* **Preload hints** : génération automatique de `<link rel="preload">` pour les chunks nécessaires
* **Type-safe** : `PreloadableComponent` offre un typage précis
* **ErrorBoundary** : isolation des erreurs par section, pas de crash global
* **Skeleton animé** : feedback visuel pendant le chargement

**Notes** :
* Chaque section est packagée dans un chunk distinct (code-splitting automatique)
* Les composants de sections **doivent** avoir un `export default`
* Les sections des modules (search, news) sont importées depuis leurs chemins respectifs

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

### 12.4 `src/entry-client.tsx` - Hydratation avec detection Sync/Async

Le fichier `entry-client.tsx` gère l'hydratation côté client avec une **détection automatique** du mode synchrone ou asynchrone de `buildRoutes()`, ce qui permet d'éviter le flash de loading pour les modules core.

#### 12.4.1 Déclarations globales TypeScript

```ts
declare global {
  interface Window {
    __CONFIG__: SiteConfig;                    // Config JSON injectée par le serveur
    __REACT_QUERY_STATE__: DehydratedState | undefined; // État React Query désérialisé
    __staticRouterHydrationData?: Partial<     // Données d'hydratation React Router
      Pick<RouterState, "errors" | "loaderData" | "actionData">
    >;
  }
}
```

Ces déclarations permettent à TypeScript de typer correctement les variables globales injectées par le serveur SSR.

#### 12.4.2 Récupération de la config et du state

```ts
const siteConfig = window.__CONFIG__;
const dehydratedState = window.__REACT_QUERY_STATE__ ?? null;
```

- `siteConfig`: Configuration JSON complète du site
- `dehydratedState`: État React Query sérialisé par le serveur (pour éviter les re-fetch)

#### 12.4.3 BuildRoutes avec détection Sync/Async

```ts
// buildRoutes retourne RouteObject[] (sync) ou Promise<RouteObject[]> (async)
// Sync : côté client avec modules core uniquement → pas de flash loading
// Async : côté serveur ou modules optional → loading temporaire
const routesOrPromise = buildRoutes(siteConfig);
```

**Comportement de `buildRoutes()` côté client**:
- **Mode SYNCHRONE** (modules core uniquement): Retourne directement `RouteObject[]`
- **Mode ASYNCHRONE** (avec modules optional): Retourne `Promise<RouteObject[]>`

**Pourquoi cette distinction ?**
- **Modules core** (type: "core"): Chargés en eager (synchrone), pas de code-splitting → pas de flash
- **Modules optional** (type: "optional"): Chargés en lazy (asynchrone), avec code-splitting → flash temporaire

#### 12.4.4 Composant Root avec gestion Sync/Async

```tsx
function Root() {
  // 1. Créer le QueryClient (une seule fois)
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,  // Évite le refetch immédiat après hydratation
      },
    },
  }));

  // 2. Initialiser le router (sync ou null si async)
  const [router, setRouter] = useState<ReturnType<typeof createBrowserRouter> | null>(() => {
    if (routesOrPromise instanceof Promise) {
      // Async : modules optional → initialiser à null
      return null;
    } else {
      // Sync : modules core → créer le router immédiatement (pas de flash!)
      return createBrowserRouter(routesOrPromise, {
        hydrationData: window.__staticRouterHydrationData
      });
    }
  });

  // 3. Charger le router de manière asynchrone si nécessaire
  useEffect(() => {
    if (routesOrPromise instanceof Promise) {
      routesOrPromise
        .then((routes) => createBrowserRouter(routes, {
          hydrationData: window.__staticRouterHydrationData
        }))
        .then(setRouter);
    }
  }, []);

  // 4. Si router pas encore chargé, garder le HTML SSR intact
  if (!router) {
    return null;  // ✅ Pas de flash, le HTML SSR reste affiché
  }

  // 5. Hydratation normale
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
```

**Flux d'exécution détaillé**:

1. **QueryClient**: Créé une seule fois avec `useState(() => ...)` (lazy initialization)
2. **Router initialization**:
   - **Si sync** (`RouteObject[]`): Créer le router immédiatement dans `useState`
   - **Si async** (`Promise<RouteObject[]>`): Initialiser `router` à `null`
3. **useEffect**: Si async, charger les routes puis créer le router
4. **Rendu conditionnel**:
   - Si `router === null`: Retourne `null` → le HTML SSR reste affiché (pas de flash)
   - Si `router !== null`: Hydrate normalement avec `RouterProvider`

#### 12.4.5 Avantage de ce pattern

**Modules core uniquement (mode sync)**:
```
buildRoutes → RouteObject[] → createBrowserRouter → Hydratation immédiate
                                                       ↓
                                               Pas de flash!
```

**Avec modules optional (mode async)**:
```
buildRoutes → Promise<RouteObject[]> → router=null → HTML SSR affiché
                                              ↓
                                        useEffect résout
                                              ↓
                                   createBrowserRouter → setRouter → Hydratation
                                                                        ↓
                                                              Flash temporaire
```

**⚠️ Limitation**: Si modules optional sont présents, l'utilisateur verra temporairement le HTML SSR sans interactivité jusqu'à ce que le code-splitting soit terminé.

**✅ Avantage**: Pour les modules core (profil, search), aucun flash de loading → expérience instantanée.

#### 12.4.6 Hydratation React Query

```tsx
<HydrationBoundary state={dehydratedState}>
  <RouterProvider router={router} />
</HydrationBoundary>
```

Le `HydrationBoundary` reprend l'état React Query sérialisé par le serveur:
- **Évite les re-fetch** inutiles après hydratation
- **Garantit la cohérence** entre SSR et client
- **Améliore les performances** (pas d'attente réseau)

#### 12.4.7 Hydratation Helmet (meta tags)

```tsx
<HelmetProvider>
  {/* ... */}
</HelmetProvider>
```

Le `HelmetProvider` synchronise les meta tags entre serveur et client:
- Côté serveur: `react-helmet` génère les tags dans `<head>`
- Côté client: `react-helmet` prend le contrôle des tags existants
- Permet les mises à jour dynamiques des meta tags lors de la navigation

#### 12.4.8 Point d'entrée final

```tsx
const container = document.getElementById("root");

if (container) {
  hydrateRoot(container, <Root />);
} else {
  console.error("❌ #root non trouvé pour l'hydratation");
}
```

- `hydrateRoot`: Fonction React 18+ pour hydrater un rendu SSR
- Réutilise le HTML généré par le serveur au lieu de le remplacer
- Attache les event listeners pour rendre l'UI interactive

#### 12.4.9 Initialisation i18n

```ts
import "@/i18n"; // init react-i18next via I18nBridge
```

L'import de `@/i18n` initialise react-i18next côté client:
- Charge les traductions depuis les bundles
- Configure le détecteur de langue
- Synchronise avec les traductions SSR

---

### 12.5 Pattern SSR Loader - Pre-fetching des données

Les **loaders** de React Router permettent de pré-charger les données côté serveur avant le rendu. SiteForge utilise ce pattern dans tous les modules qui nécessitent des données API (profil, search, etc.).

#### 12.5.1 Principe du SSR Loader

Le loader est une fonction asynchrone qui:
1. S'exécute **avant le rendu** de la route (côté serveur uniquement en SSR)
2. Pré-charge les données dans **React Query**
3. Désérialise l'état React Query dans le HTML
4. Évite les **double-fetch** côté client (hydratation sans refetch)

**Avantages**:
- **SEO**: Les données sont dans le HTML initial (indexables par les moteurs de recherche)
- **Performance**: Pas d'attente réseau côté client
- **UX**: Pas de spinner de chargement lors de la navigation initiale

#### 12.5.2 Anatomie d'un loader

Un loader typique suit ce pattern:

```ts
// Dans routes.tsx d'un module
export const routes: ModuleRouteFactory = (queryClient?: QueryClient): RouteObject[] => [
  {
    path: ":slug",
    element: <ProfilePage />,
    loader: async ({ params }: LoaderFunctionArgs) => {
      // 1. Si pas de queryClient (côté client), skip le pre-fetch
      if (!queryClient) return null;

      // 2. Extraire et valider les paramètres
      const slug = params.slug?.startsWith('@')
        ? params.slug.slice(1)
        : params.slug;

      if (!slug) {
        throw new Response('Not Found', { status: 404 });
      }

      try {
        // 3. Pré-charger les données dans React Query
        return await queryClient.ensureQueryData({
          queryKey: ["element-about", slug],
          queryFn: async () => {
            const { organization } = await initApi({
              baseURL: getBaseUrl(),
              debug: true
            });
            return organization.entityBySlug(slug);
          }
        });
      } catch (error) {
        console.error('Erreur lors du chargement du profil:', error);
        throw new Response('Not Found', { status: 404 });
      }
    }
  }
];
```

#### 12.5.3 Détection côté serveur vs client

```ts
if (!queryClient) return null;
```

**Pourquoi cette vérification ?**
- **Côté serveur** (SSR): `buildRoutes(config, queryClient)` passe un `queryClient` → le loader s'exécute
- **Côté client** (navigation): `buildRoutes(config)` ne passe **pas** de `queryClient` → le loader est skippé

**Avantage**: Évite les double-fetch. Côté client, le composant utilise `useQuery` qui récupère les données depuis le cache React Query.

#### 12.5.4 Utilisation de ensureQueryData

```ts
await queryClient.ensureQueryData({
  queryKey: ["element-about", slug],
  queryFn: async () => {
    // Appel API
    return organization.entityBySlug(slug);
  }
});
```

**`ensureQueryData` vs `fetchQuery`**:
- `fetchQuery`: **Toujours** fetch, même si les données sont en cache
- `ensureQueryData`: Fetch **uniquement si** les données ne sont pas en cache

**Avantage**: Si plusieurs loaders utilisent la même `queryKey`, un seul fetch est effectué.

#### 12.5.5 Gestion des erreurs dans les loaders

Les loaders peuvent throw des `Response` pour gérer les erreurs:

```ts
// 404 Not Found
throw new Response('Not Found', { status: 404 });

// 500 Server Error
throw new Response('Internal Server Error', { status: 500 });

// Redirect
throw redirect('/login');
```

React Router capture ces erreurs et les affiche via `errorElement` ou `ErrorBoundary`.

#### 12.5.6 Désérialisation de l'état React Query

Côté serveur (`entry-server.tsx`):

```ts
// 1. Déshydrater l'état après le rendu
const dehydratedState = dehydrate(queryClient, {
  shouldDehydrateQuery: (q) => q.queryKey[0] !== "cocolight-init"
});

// 2. Injecter dans le HTML
res.write(`<script>window.__REACT_QUERY_STATE__=${serialize(dehydratedState)}</script>`);
```

Côté client (`entry-client.tsx`):

```ts
// 3. Récupérer l'état
const dehydratedState = window.__REACT_QUERY_STATE__ ?? null;

// 4. Hydrater React Query
<HydrationBoundary state={dehydratedState}>
  <RouterProvider router={router} />
</HydrationBoundary>
```

**Flux complet**:
1. Serveur: Loader pré-charge → React Query cache
2. Serveur: Déshydratation → `window.__REACT_QUERY_STATE__`
3. Client: Récupération → Hydratation React Query
4. Client: `useQuery` trouve les données dans le cache → pas de refetch

#### 12.5.7 Pattern avec initApi singleton

Les loaders utilisent souvent `initApi()` pour initialiser l'API:

```ts
queryFn: async () => {
  const { organization } = await initApi({
    baseURL: getBaseUrl(),
    debug: true
  });
  return organization.entityBySlug(slug);
}
```

**Pourquoi ce pattern ?**
- `initApi()` utilise le **singleton** d'API client (voir Section 8.1)
- Garantit qu'une seule instance API existe par requête SSR
- Partage la connexion, les tokens, et le cache entre loaders

#### 12.5.8 Exemple complet: Module Profil

```ts
// src/modules/profil/routes.tsx
export const routes: ModuleRouteFactory = (queryClient?: QueryClient): RouteObject[] => [
  {
    path: ":slug",
    element: <ProfilePage />,
    loader: async ({ params }: LoaderFunctionArgs) => {
      if (!queryClient) return null;

      const rawSlug = params.slug;
      const slug = rawSlug?.startsWith('@') ? rawSlug.slice(1) : rawSlug;

      if (!slug) {
        throw new Response('Not Found', { status: 404 });
      }

      try {
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
  }
];
```

**Usage dans le composant**:

```tsx
// src/modules/profil/pages/ProfilePage.tsx
export default function ProfilePage() {
  const { slug } = useParams();
  const cleanSlug = slug?.startsWith('@') ? slug.slice(1) : slug;

  // ✅ Les données sont déjà en cache (pré-chargées par le loader)
  const { data: entity, isLoading, isError } = useEntityBySlugQuery({ slug: cleanSlug });

  if (isLoading) return <ProfileSkeleton />;
  if (isError) return <ErrorCard />;
  if (!entity) return <NotFoundCard />;

  return <ProfileContent entity={entity} />;
}
```

**Flux d'exécution**:
1. **SSR**: Loader pré-charge `entityBySlug(slug)` → React Query cache
2. **SSR**: Déshydratation → HTML avec `window.__REACT_QUERY_STATE__`
3. **Client**: Hydratation → React Query reprend le cache
4. **Client**: `useEntityBySlugQuery` trouve les données dans le cache → `isLoading=false` immédiatement
5. **Client**: Rendu immédiat du profil (pas de spinner)

#### 12.5.9 Optimisations avancées

**1. Prefetch multiple dans un loader**:

```ts
loader: async ({ params }) => {
  if (!queryClient) return null;

  // Prefetch en parallèle
  await Promise.all([
    queryClient.ensureQueryData({
      queryKey: ["profile", params.slug],
      queryFn: () => fetchProfile(params.slug)
    }),
    queryClient.ensureQueryData({
      queryKey: ["profile-events", params.slug],
      queryFn: () => fetchProfileEvents(params.slug)
    }),
  ]);

  return null;
};
```

**2. Filtrage du cache à déshydrater**:

```ts
// Ne pas déshydrater les queries de type "cocolight-init"
const dehydratedState = dehydrate(queryClient, {
  shouldDehydrateQuery: (query) => query.queryKey[0] !== "cocolight-init"
});
```

**Raison**: Certaines queries sont spécifiques au serveur et ne doivent pas être envoyées au client (tokens sensibles, config serveur, etc.).

#### 12.5.10 Limitations et considérations

**⚠️ Limitations**:
- Les loaders s'exécutent **uniquement** lors de la navigation initiale SSR
- Lors de la navigation client-side (SPA), les loaders ne s'exécutent pas avec `queryClient`
- Les données doivent être **sérialisables** (pas de fonctions, de classes avec méthodes, etc.)

**✅ Bonnes pratiques**:
- Toujours vérifier `if (!queryClient) return null;`
- Utiliser `ensureQueryData` plutôt que `fetchQuery` pour éviter les double-fetch
- Utiliser la même `queryKey` dans le loader et dans `useQuery`
- Gérer les erreurs avec `throw new Response(...)`

---

Avec ces quatre fichiers, SiteForge propose :

* Un **dev-server** ultra-rapide (HMR + SSR on‑the‑fly).
* Un **prod-server** optimisé (gzip, caching long, injection config/env, streaming SSR).
* Un **entry-server** robuste (React Router loaders, React Query prefetch, streaming avec Helmet).
* Un **entry-client** fluide (hydrateRoot, React Query, React Router hydratation).
