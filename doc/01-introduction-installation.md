[← Retour à l'index](README.md)

# Introduction et installation

**Sommaire**

- [Introduction et installation](#introduction-et-installation)
  - [Présentation du projet](#présentation-du-projet)
  - [Stack technique](#stack-technique)
  - [Objectifs](#objectifs)
  - [Structure d'ensemble du repository](#structure-densemble-du-repository)
- [Installation et démarrage](#installation-et-démarrage)
  - [Prérequis](#prérequis)
  - [Clonage du dépôt](#clonage-du-dépôt)
  - [Installation des dépendances](#installation-des-dépendances)
  - [Configuration des variables d'environnement](#configuration-des-variables-denvironnement)
  - [Commandes principales](#commandes-principales)
  - [Voir aussi](#voir-aussi)

---

## Présentation du projet

SiteForge est un générateur de sites web piloté par un simple fichier JSON. Son objectif est de démocratiser la création de sites statiques ou SSR sans écrire une seule ligne de HTML/CSS/JS, tout en offrant :

* **Modularité** : chaque partie du site (header, sections, footer…) est un composant React réutilisable.
* **Performance** : lazy loading, code splitting, optimisation d'images, SSR streaming.
* **Extensibilité** : on peut ajouter de nouveaux types de sections ou modules (recherche, formulaires, notifications, etc.).
* **Internationalisation** : prise en charge native de plusieurs langues via Zod, JSON et hooks de traduction.
* **Sécurité** : validation des schémas JSON (Zod), sanitisation du contenu (DOMPurify) et bonnes pratiques serveur.
* **Multi-site** : un seul codebase sert plusieurs sites via `sites.json` (résolution par slug) — mode dev/staging ; en production chaque site est un build mono-slug dans son propre conteneur.

## Stack technique

| Technologie | Version |
|---|---|
| React | 19.2.x |
| Vite | 7.x |
| React Router | 7.x |
| Tailwind CSS | 4.x |
| TypeScript | 5.8.x |
| Zod | 4.x |
| Express | 5.x |
| Vitest | 4.x |
| Playwright | 1.58.x |
| Node.js (requis) | 22.x LTS |

## Objectifs

* Permettre à des non-développeurs de configurer un site professionnel uniquement via JSON.
* Offrir aux développeurs un cadre flexible pour étendre ou personnaliser chaque composant.
* Garantir un rendu rapide et optimisé, côté client et côté serveur (SSR).

## Structure d'ensemble du repository

```
.
├── scripts/               # Génération de fichiers de config automatisée
│   └── generate-config.ts # Script de génération de config (tsx)
├── server/                # Serveurs Express pour dev (middleware Vite) et prod (SSR)
│   ├── api/               # Couche API serveur
│   ├── middleware/        # Middlewares Express
│   │   ├── imageOptimizer.js  # Optimisation d'images à la volée (sharp, cache disque)
│   │   └── imageUpload.js     # Upload d'images (multer)
│   ├── utils/             # Utilitaires serveur
│   │   └── normalizeSiteConfig.js  # Pré-sanitisation HTML/SVG (DOMPurify) au démarrage
│   ├── dev-server.js      # Serveur de développement avec Vite en middleware
│   └── prod-server.js     # Serveur de production, compression & rendu SSR
├── src/                   # Code source principal
│   ├── components/        # Composants React UI (layout/, sections/, ui/)
│   ├── config/            # Configuration applicative
│   ├── constants/         # Constantes partagées
│   ├── contexts/          # Providers React (Cocolight, i18n, SiteContext…)
│   ├── data/              # Exemples de configuration (demo-site.ts)
│   ├── helpers/           # Fonctions utilitaires (email, date…)
│   ├── hooks/             # Hooks React personnalisés (useToast, useCocolight…)
│   ├── lib/               # API client, routes dynamiques, utils génériques
│   ├── modules/           # Modules fonctionnels (search, profil, news, ampli, coform,
│   │                      #   cagnotte, interop, auth, notification)
│   ├── pages/             # Pages spéciales hors JSON (404, etc.)
│   ├── types/             # Schémas Zod & types TypeScript (site-schema, locale-schema…)
│   ├── utils/             # Utilitaires côté client
│   ├── i18n.ts            # Configuration i18next globale
│   ├── entry-client.tsx   # Point d'entrée client pour le bundler Vite
│   ├── entry-server.tsx   # Point d'entrée SSR pour la génération de HTML
│   └── RootLayout.tsx     # Layout racine avec tous les providers et l'Outlet React Router
├── tests/                 # Tests d'intégration SSR (Vitest)
├── e2e/                   # Tests end-to-end (Playwright)
├── doc/                   # Documentation du projet
├── .gitignore             # Fichiers ignorés par Git
├── .nvmrc                 # Version Node.js requise (22.18.0)
├── config.prod.json       # Configuration JSON de production par défaut
├── config.prod.tiers-lieux.json      # Variante site Tiers-Lieux
├── config.prod.rezo-la-mer.json      # Variante site Rézo La Mer
├── config.prod.cyber-reunion.json    # Variante Cyber-Réunion
├── config.prod.nos-commune.json      # Variante Nos Communes
├── config.prod.commune-transparente.json  # Variante Commune Transparente
├── config.prod.sport-sante-bien-etre.json # Variante Sport Santé Bien-être
├── config.prod.julie-pot-vin.json    # Variante Julie Pot Vin
├── config.prod.institut-bleu.json    # Variante Institut Bleu
├── config.prod.open-atlas-test.json  # Variante Open Atlas (test)
├── config.prod.equipements-Sportifs.json  # Variante Équipements Sportifs
├── config.prod.eXtremeDefiAdeme.json # Variante eXtremeDefi Ademe
├── sites.json             # Table de correspondance slug → fichier config + CSS
├── site-config.json       # Config alternative
├── config.dev.json        # Configuration de développement
├── docker-compose.yml     # Orchestration Docker
├── Dockerfile             # Build multi-étapes (Node 22-alpine)
├── package.json           # Dépendances, scripts et résolutions de versions
├── tsconfig.json          # Config TypeScript racine (références de projets)
├── tsconfig.app.json      # Config TypeScript application (src/)
├── tsconfig.node.json     # Config TypeScript serveur/scripts (Node)
├── vite.config.ts         # Configuration du bundler Vite (alias, plugins, SSR)
├── vitest.config.ts       # Config Vitest par défaut
├── vitest.config.unit.ts  # Config Vitest tests unitaires
├── vitest.config.integration.ts  # Config Vitest tests d'intégration SSR
└── playwright.config.ts   # Configuration Playwright (E2E)
```

Chaque dossier et fichier principal sera détaillé dans les sections suivantes de la documentation.

---

# Installation et démarrage

## Prérequis

* **Node.js** 22.x LTS — version exacte dans `.nvmrc` (`22.18.0`). Node 22 est requis car c'est la base du `Dockerfile` (image `node:22-alpine`).

  Avec [nvm](https://github.com/nvm-sh/nvm) :
  ```bash
  nvm install
  nvm use
  ```

* **npm** ≥ 10.x (fourni avec Node 22)
* **Git** (pour cloner le dépôt)
* Un éditeur de code (VS Code recommandé)

> **Optionnel** :
>
> * **Docker** si vous souhaitez containeriser l'application
> * **Make** ou équivalent pour automatiser les tâches

---

## Clonage du dépôt

```bash
git clone <URL_DU_REPOSITORY>
cd <NOM_DU_REPOSITORY>
```

---

## Installation des dépendances

```bash
npm install
```

> Le projet utilise **npm** comme gestionnaire de paquets (un `package-lock.json` est versionné). Yarn n'est pas recommandé pour éviter des divergences de résolution de dépendances.

---

## Configuration des variables d'environnement

Créez un fichier `.env` à la racine du projet (voir [Configuration](02-configuration.md) pour le détail des variables) :

```dotenv
# Mode d'exécution
NODE_ENV=development

# Port de développement
PORT=5173

# Fichiers de configuration du site
# En développement, on peut charger directement le fichier JSON
SITE_CONFIG_PATH=./config.prod.json

# Variables côté client (préfixées VITE_)
VITE_BASE_URL_BACKEND=http://localhost:3000
VITE_SERVER_URL=http://localhost:3000
VITE_SLUG=default
```

Toutes les variables disponibles sont documentées dans [Configuration](02-configuration.md). Les variables les plus courantes :

| Variable | Description | Défaut |
|---|---|---|
| `NODE_ENV` | `development` \| `production` | Défini par Vite/npm |
| `PORT` | Port du serveur | `5173` (dev), `3000` (prod) |
| `SITE_CONFIG_JSON` | JSON de config inline (priorité maximale) | — |
| `SITE_CONFIG_PATH` | Chemin vers le fichier JSON de config | — |
| `VITE_BASE_URL_BACKEND` | URL de l'API backend | `http://localhost:3000` |
| `VITE_SERVER_URL` | URL publique du serveur | `http://localhost:3000` |
| `VITE_SLUG` | Slug du site pour la résolution multi-site | `default` |

---

## Commandes principales

| Commande | Description |
|---|---|
| `npm run dev` | Démarrage du serveur de développement (Vite + SSR + HMR) |
| `npm run build` | Compilation complète : `clean` + `build:client` + `build:server` |
| `npm run build:client` | Build client uniquement (`tsc -b` + `vite build --outDir dist/client`) |
| `npm run build:server` | Build SSR uniquement (`vite build --ssr src/entry-server.tsx --outDir dist/server`) |
| `npm run preview` | Prévisualisation du build de production (lance `prod-server.js` avec `NODE_ENV=production`) |
| `npm run start` | Lancement du serveur de production Express SSR |
| `npm run typecheck` | Vérification de types TypeScript (`tsc -b --noEmit`) |
| `npm run clean` | Suppression de `dist/` et des fichiers `tsconfig.tsbuildinfo` |
| `npm run build:config` | Génération de config via `tsx scripts/generate-config.ts` |
| `npm run lint` | Exécution d'ESLint pour vérifier la qualité du code |

> **Remarque TypeScript** : le projet utilise les **références de projets TypeScript** (`tsconfig.json` avec `files: []`). Toujours utiliser `tsc -b` (pas `tsc` seul) pour la vérification de types — c'est ce que fait `npm run typecheck`.

**Commandes de test** (voir [doc/15-tests.md](15-tests.md) pour le détail) :

| Commande | Description |
|---|---|
| `npm run test:unit` | Tests unitaires et preflight (Vitest, aucun serveur requis) |
| `npm run test:integration` | Tests d'intégration SSR avec serveur dédié sur port 5188 (Vitest) |
| `npm run test:e2e` | Tests end-to-end navigateur (Playwright) |
| `npm run test:all` | Exécute les trois niveaux séquentiellement |
| `npm run test:watch` | Tests unitaires en mode watch |
| `npm run test:preflight` | Tests preflight uniquement |
| `npm run test:coverage` | Tests unitaires avec rapport de couverture (v8) |

> **Remarques** :
>
> * En mode **dev**, Vite fournit le HMR et le middleware SSR ; le rechargement de config s'effectue via WebSocket.
> * En mode **build** puis **preview** / **start**, le client est servi depuis `dist/client` et le SSR depuis `dist/server`.
> * `npm run preview` pointe par défaut sur `config.prod.tiers-lieux.json` ; ajustez `SITE_CONFIG_PATH` si nécessaire.

---

## Voir aussi

- [Configuration](02-configuration.md)
- [Architecture](03-architecture.md)
- [Tests](15-tests.md)
