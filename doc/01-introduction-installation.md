[← Retour à l'index](README.md)

# Introduction et installation

**Sommaire**

- [Introduction et installation](#introduction-et-installation)
  - [Présentation du projet](#présentation-du-projet)
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
* **Extensibilité** : on peut ajouter de nouveaux types de sections ou modules (ex. recherche, formulaires).
* **Internationalisation** : prise en charge native de plusieurs langues via Zod, JSON et hooks de traduction.
* **Sécurité** : validation des schémas JSON (Zod), sanitisation du contenu (DOMPurify) et bonnes pratiques serveur.

## Objectifs

* Permettre à des non-développeurs de configurer un site professionnel uniquement via JSON.
* Offrir aux développeurs un cadre flexible pour étendre ou personnaliser chaque composant.
* Garantir un rendu rapide et optimisé, côté client et côté serveur (SSR).

## Structure d'ensemble du repository

```
.
├── scripts/               # Génération de fichiers de config automatisée
├── server/                # Serveurs Express pour dev (middleware Vite) et prod (SSR)
│   ├── middleware/         # Middlewares Express
│   │   ├── imageOptimizer.js  # Optimisation d'images à la volée (sharp, cache disque)
│   │   └── imageUpload.js     # Upload d'images (multer)
│   ├── dev-server.js      # Serveur de développement avec Vite en middleware
│   └── prod-server.js     # Serveur de production, compression & rendu SSR
├── src/                   # Code source principal
│   ├── components/        # Composants React UI (layout/, sections/, ui/)
│   ├── contexts/          # Providers React (Cocolight, i18n, SiteContext…)
│   ├── data/              # Exemples de configuration (demo-site.ts)
│   ├── helpers/           # Fonctions utilitaires (email, date…)
│   ├── hooks/             # Hooks React personnalisés (useToast, useCocolight…)
│   ├── lib/               # API client, routes dynamiques, utils génériques
│   ├── modules/           # Modules fonctionnels (search, profil, news, ampli, coform)
│   ├── types/             # Schémas Zod & types TypeScript (site-schema, locale-schema…)
│   ├── entry-client.tsx   # Point d'entrée client pour le bundler Vite
│   ├── entry-server.tsx   # Point d'entrée SSR pour la génération de HTML
│   └── RootLayout.tsx     # Layout racine avec tous les providers et l'Outlet React Router
├── tests/                 # Tests d'intégration SSR (Vitest)
├── e2e/                   # Tests end-to-end (Playwright)
├── doc/                   # Documentation du projet
├── .gitignore             # Fichiers ignorés par Git
├── config.prod.json       # Configuration JSON de production (meta, header, pages…)
├── package.json           # Dépendances, scripts et résolutions de versions
├── tsconfig*.json         # Configurations TypeScript
└── vite.config.ts         # Configuration du bundler Vite (alias, plugins, SSR)
```

Chaque dossier et fichier principal sera détaillé dans les sections suivantes de la documentation.

---

# Installation et démarrage

## Prérequis

* **Node.js** ≥ 18.x (LTS)
* **npm** ≥ 9.x ou **Yarn** ≥ 1.x
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

# Variables coté client (préfixées VITE_)
VITE_BASE_URL_BACKEND=http://localhost:3000
VITE_SERVER_URL=http://localhost:3000
VITE_SLUG=default
```

---

## Commandes principales

| Commande                           | Description                                                     |
| ---------------------------------- | --------------------------------------------------------------- |
| `npm run dev`                      | Démarrage du serveur de développement (Vite + SSR)              |
| `npm run build`                    | Compilation client (`build:client`) et serveur (`build:server`) |
| `npm run preview`                  | Prévisualisation du build de production                         |
| `npm run start`                    | Lancement du serveur de production (Express SSR)                |
| `npm run typecheck`               | Vérification de types TypeScript (`tsc -b --noEmit`)            |
| `npm run clean`                    | Suppression de `dist/` et `tsconfig.tsbuildinfo`                |
| `npm run build:config`             | Génération de config via `tsx scripts/generate-config.ts`       |
| `npm run lint`                     | Exécution d'ESLint pour vérifier la qualité du code             |

**Commandes de test** (voir [doc/15-tests.md](15-tests.md) pour le détail) :

| Commande                           | Description                                                     |
| ---------------------------------- | --------------------------------------------------------------- |
| `npm run test:unit`                | Tests unitaires et preflight (Vitest)                           |
| `npm run test:integration`         | Tests d'intégration SSR avec serveur dédié (Vitest)             |
| `npm run test:e2e`                 | Tests end-to-end navigateur (Playwright)                        |
| `npm run test:all`                 | Exécute les trois niveaux séquentiellement                      |
| `npm run test:watch`               | Tests unitaires en mode watch                                   |

> **Remarque** :
>
> * En mode **dev**, Vite fournit le HMR et le middleware SSR.
> * En mode **build** puis **preview**, le client est servi depuis `dist/client` et le SSR depuis `dist/server`.

---

## Voir aussi

- [Configuration](02-configuration.md)
- [Architecture](03-architecture.md)
