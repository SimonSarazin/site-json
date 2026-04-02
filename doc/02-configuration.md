[← Retour à l'index](README.md)

# Configuration

**Sommaire**

- [Configuration](#configuration)
  - [Variables d'environnement](#variables-denvironnement)
  - [Fichiers JSON de configuration](#fichiers-json-de-configuration)
    - [`config.prod.json`](#configprodjson)
    - [Mécanisme `sites.json` et hot-reload config](#mécanisme-sitesjson-et-hot-reload-config)
  - [Fichier de configuration Vite (`vite.config.ts`)](#fichier-de-configuration-vite-viteconfigts)
  - [Voir aussi](#voir-aussi)

---

La configuration de SiteForge se fait principalement via :

1. **Variables d'environnement**
2. **Fichiers JSON de configuration**
3. **Fichier de configuration Vite**

---

## Variables d'environnement

| Variable                | Description                                                                                | Valeur par défaut              |
| ----------------------- | ------------------------------------------------------------------------------------------ | ------------------------------ |
| `SITE_CONFIG_JSON`      | JSON complet de la configuration du site. Si présent, il est parsé directement.            | —                              |
| `SITE_CONFIG_PATH`      | Chemin vers un fichier JSON contenant la configuration du site.                            | —                              |
| `VITE_BASE_URL_BACKEND` | URL de base pour les appels API depuis le client (injectée en tant que `import.meta.env`). | `http://localhost:3000`        |
| `VITE_SERVER_URL`       | URL publique du serveur (injectée en tant que `import.meta.env`).                          | `http://localhost:3000`        |
| `VITE_SLUG`             | « Slug » à utiliser pour les requêtes par défaut (injecté en tant que `import.meta.env`).  | `default`                      |
| `NODE_ENV`              | Mode d'exécution Node.js (`development` ou `production`).                                  | Défini par Vite ou `npm run …` |
| `PORT`                  | Port sur lequel le serveur écoute en mode dev ou preview.                                  | `5173` en dev, `3000` en prod  |
| `SITE_CSS_CONTENT`      | Contenu CSS complet inline (build-time). Priorite maximale pour la resolution CSS.            | —                              |
| `SITE_CSS_PATH`         | Chemin vers un fichier CSS personnalisé (build-time). Prioritaire sur le lookup `sites.json`. | —                              |
| `VITE_MON_API_KEY` | Clé API pour services externes (injectée via `import.meta.env`). | `default-api-key` |
| `VITE_MON_DOMAIN` | Domaine pour services externes (injecté via `import.meta.env`). | `default-domain.com` |
| `IMAGE_OPTIMIZER_ALLOWED_DOMAINS` | Domaines distants autorisés pour l'optimisation d'images (séparés par des virgules). | `localhost,127.0.0.1` + hostname de `VITE_BASE_URL_BACKEND` |

> **En production**, au moins `SITE_CONFIG_JSON` **ou** `SITE_CONFIG_PATH` doit être défini — sinon le serveur arrête le démarrage avec une erreur.

La fonction utilitaire `readEnv` centralise la lecture :

```ts
function readEnv<K extends keyof RuntimeEnv>(
  key: K, fallback: string
): string {
  const value =
    (typeof window !== 'undefined' ? window.__ENV__?.[key] : undefined) ??
    (typeof process !== 'undefined' ? process.env?.[key] : undefined) ??
    (typeof import.meta !== 'undefined' ? (import.meta.env as RuntimeEnv)?.[key] : undefined);
  return typeof value === 'string' && value.length ? value : fallback;
}
```

---

## Fichiers JSON de configuration

### `config.prod.json`

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

### Mécanisme `sites.json` et hot-reload config

Si `SITE_CONFIG_PATH` n'est pas défini mais que `VITE_SLUG` l'est, le serveur de développement cherche dans `sites.json` une entrée correspondant au slug pour résoudre le chemin du fichier config. Chaque entrée de `sites.json` associe un `slug` à un fichier `config` et un fichier `css`.

En développement, la config est chargée **une seule fois** au démarrage et cachée en mémoire (`cachedConfig`). Le fichier config est ensuite surveillé avec `fs.watchFile` : toute modification est envoyée aux clients via le WebSocket Vite pour un hot-reload immédiat. Voir [Backend et SSR](14-backend-ssr.md) pour les détails techniques.

---

## Fichier de configuration Vite (`vite.config.ts`)

Vite est configuré pour supporter :

* **Alias** : `@` → `./src`
* **Plugins** :
  - `siteCssPlugin()` : plugin custom de résolution CSS virtuelle (`virtual:site-css`). Résout le fichier CSS du site selon l'ordre de priorité : `SITE_CSS_CONTENT` > `SITE_CSS_PATH` > `VITE_SLUG` (lookup `sites.json`) > `src/index.css`
  - `preloadPlugin()` (de `vite-preload`) : trace les imports lazy pour générer les balises `<link rel="modulepreload">` en SSR. Doit être **avant** `react()` pour tracer les lazy imports
  - `react()` : support React avec JSX automatique
  - `tailwindcss()` : compilation Tailwind CSS 4
  - `visualizer()` (de `rollup-plugin-visualizer`) : génère `dist/stats.html` pour l'analyse de bundle (uniquement pour le build client)
* **Définition d'environnements** :

  ```ts
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
  }
  ```
* **SSR** : la configuration SSR est **conditionnelle** selon `isSsrBuild` :

  ```ts
  ssr: {
    noExternal: isSsrBuild ? true : undefined,
    external: isSsrBuild
      ? [
          'express',
          'compression',
          'serialize-javascript',
          'isomorphic-dompurify',
          '@communecter/cocolight-api-client',
          'sharp',
          'pino',
          'pino-pretty',
          'react',
          'react-dom',
          'react/jsx-runtime',
          'react/jsx-dev-runtime',
        ]
      : [
          '@communecter/cocolight-api-client',
          'pino',
          'pino-pretty',
        ],
  }
  ```

  - En **build SSR** (`isSsrBuild: true`) : `noExternal: true` (tout est bundlé sauf les externes listés). Les externes incluent `react` et `react-dom` pour éviter la duplication.
  - En **dev** (`isSsrBuild: false/undefined`) : `noExternal` n'est pas défini, seuls `@communecter/cocolight-api-client`, `pino` et `pino-pretty` sont externalisés.
* **Server warmup** : pré-charge les fichiers SSR et client au démarrage du serveur de dev :

  ```ts
  server: {
    warmup: {
      ssrFiles: ['./src/entry-server.tsx'],
      clientFiles: ['./src/entry-client.tsx'],
    },
  },
  ```
* **Optimisations** : exclusion de `lucide-react` en dev, `manualChunks` pour le build client

---

## Voir aussi

- [Introduction & Installation](01-introduction-installation.md)
- [Architecture](03-architecture.md)
