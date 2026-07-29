[← Retour à l'index](README.md)

# Configuration

**Sommaire**

- [Configuration](#configuration)
  - [Variables d'environnement](#variables-denvironnement)
    - [Variables principales (serveurs dev et prod)](#variables-principales-serveurs-dev-et-prod)
    - [Variables HelloAsso (module cagnotte)](#variables-helloasso-module-cagnotte)
    - [Variables injectées dans `window.__ENV__`](#variables-injectées-dans-window__env__)
  - [Résolution de configuration en 3 niveaux](#résolution-de-configuration-en-3-niveaux)
    - [En développement (`dev-server.js`)](#en-développement-dev-serverjs)
    - [En production (`prod-server.js`)](#en-production-prod-serverjs)
  - [Fichiers JSON de configuration](#fichiers-json-de-configuration)
    - [Fichiers disponibles](#fichiers-disponibles)
    - [Structure d'un fichier config](#structure-dun-fichier-config)
    - [Mécanisme `sites.json`](#mécanisme-sitesjson)
    - [Hot-reload config (dev uniquement)](#hot-reload-config-dev-uniquement)
  - [Résolution CSS (`virtual:site-css`)](#résolution-css-virtualsite-css)
  - [Fichier de configuration Vite (`vite.config.ts`)](#fichier-de-configuration-vite-viteconfigts)
  - [Voir aussi](#voir-aussi)

---

La configuration de SiteForge se fait principalement via :

1. **Variables d'environnement**
2. **Fichiers JSON de configuration**
3. **Fichier de configuration Vite**

---

## Variables d'environnement

### Variables principales (serveurs dev et prod)

| Variable | Description | Valeur par défaut |
| -------- | ----------- | ----------------- |
| `SITE_CONFIG_JSON` | JSON complet de la configuration du site (priorité maximale). Si présent, parsé directement sans lecture de fichier. | — |
| `SITE_CONFIG_PATH` | Chemin vers un fichier JSON contenant la configuration du site (priorité 2). | — |
| `VITE_SLUG` | Slug de site utilisé pour la résolution via `sites.json` (priorité 4 en production, 3 en développement). En production, ne se déclenche que hors conteneur : l'image ne contient pas `sites.json`. | `default` |
| `SITE_EMBED` | **Build uniquement.** À `true`, fige la config résolue dans `dist/site-config.json` (priorité 3 au démarrage). | — |
| `SITE_IMAGES` | **Build uniquement.** Nom(s) de dossier de `public/images/` à embarquer, séparés par des virgules. Le nom se lit dans le champ `images` de `sites.json`. Absent : tous les dossiers. | — |
| `NODE_ENV` | Mode d'exécution Node.js (`development` ou `production`). | Défini par Vite/npm |
| `PORT` | Port d'écoute du serveur. | `5173` (dev), `3000` (prod) |
| `VITE_BASE_URL_BACKEND` | URL de base pour les appels API depuis le client (`import.meta.env`). Injectée aussi dans `window.__ENV__` à l'exécution. | `http://localhost:3000` |
| `VITE_SERVER_URL` | URL publique du serveur (`import.meta.env`). Injectée aussi dans `window.__ENV__`. | `http://localhost:3000` |
| `SITE_CSS_CONTENT` | Contenu CSS complet inline (build-time). Priorité maximale pour la résolution CSS. | — |
| `SITE_CSS_PATH` | Chemin vers un fichier CSS personnalisé (build-time). Prioritaire sur le lookup `sites.json`. | — |
| `IMAGE_OPTIMIZER_ALLOWED_DOMAINS` | Domaines distants autorisés pour l'optimisation d'images, séparés par des virgules. | `localhost,127.0.0.1` + hostname de `VITE_BASE_URL_BACKEND` |

> **En production**, au moins `SITE_CONFIG_JSON` **ou** `SITE_CONFIG_PATH` doit être défini — sinon le serveur arrête le démarrage avec une erreur explicite.

### Variables HelloAsso (module cagnotte)

Ces variables sont utilisées par `server/api/helloasso-checkout.js` pour le module de financement collaboratif :

| Variable | Description | Valeur par défaut |
| -------- | ----------- | ----------------- |
| `HELLOASSO_CLIENT_ID` | Client ID OAuth HelloAsso. | — |
| `HELLOASSO_CLIENT_SECRET` | Client Secret OAuth HelloAsso. | — |
| `HELLOASSO_ORGANIZATION_SLUG` | Slug de l'organisation HelloAsso (côté serveur). | — |
| `HELLOASSO_ORGANIZATION_ID` | ID de l'organisation HelloAsso. | — |
| `HELLOASSO_PUBLIC_BASE_URL` | URL publique de l'API HelloAsso. | — |
| `HELLOASSO_OAUTH_TOKEN_URL` | URL du endpoint OAuth pour obtenir les tokens. | — |
| `HELLOASSO_DEV_MODE` | Active le mode développement HelloAsso (sandbox). | — |
| `VITE_HELLOASSO_ORGANIZATION_SLUG` | Slug de l'organisation HelloAsso (côté client, `import.meta.env`). | — |
| `APP_BASE_URL` | URL de base de l'application (utilisée pour les callbacks HelloAsso). | — |
| `PUBLIC_BASE_URL` | URL publique de base pour les redirections. | — |
| `NGROK_URL` | URL ngrok pour les webhooks en développement local. | — |
| `VITE_PUBLIC_BASE_URL` | URL publique exposée côté client (`import.meta.env`). | — |
| `VITE_NGROK_URL` | URL ngrok exposée côté client (`import.meta.env`). | — |

### Variables injectées dans `window.__ENV__`

À l'exécution, les serveurs (dev et prod) injectent un script `window.__ENV__` dans chaque réponse HTML. Les variables suivantes sont disponibles dans le navigateur via `window.__ENV__` (et lues par `readEnv()` dans `src/lib/constant/common.ts`) :

| Variable | Accesseurs côté client |
| -------- | ---------------------- |
| `VITE_BASE_URL_BACKEND` | `getBaseUrl()` |
| `VITE_SERVER_URL` | `getServerUrl()` |
| `VITE_SLUG` | `getSlug()` |
| `VITE_MON_API_KEY` | `getMonApiKey()` — défaut `"default-api-key"` |
| `VITE_MON_DOMAIN` | `getMonDomain()` — défaut `"default-domain.com"` |

> **Note** : `VITE_MON_API_KEY` et `VITE_MON_DOMAIN` ne sont pas injectées par les serveurs dans `window.__ENV__` ; elles sont lues uniquement depuis `import.meta.env` (build-time) ou `process.env` (SSR). Les valeurs par défaut sont codées dans `src/lib/constant/common.ts`.

La fonction utilitaire `readEnv` centralise la lecture avec priorité `window.__ENV__` > `process.env` > `import.meta.env` :

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

## Résolution de configuration en 3 niveaux

La résolution de la configuration du site suit une hiérarchie stricte, implémentée dans `loadSingleConfig()` (dev) et `loadSiteConfig()` (prod).

### En développement (`dev-server.js`)

```
SITE_CONFIG_JSON  →  parse direct
        ↓ (absent)
SITE_CONFIG_PATH  →  lecture fichier
        ↓ (absent)
VITE_SLUG + sites.json  →  résolution slug → chemin → lecture fichier
        ↓ (slug absent ou non trouvé)
demo-site.ts  →  config de démonstration (chargée via vite.ssrLoadModule)
```

- Si le slug n'est pas trouvé dans `sites.json`, un warning est affiché avec la liste des slugs disponibles.
- Quand la résolution par slug réussit, `SITE_CONFIG_PATH` est automatiquement renseignée avec le chemin résolu (ce qui active le hot-reload).
- La config est ensuite passée dans `normalizeSiteConfig()` pour pré-sanitizer les champs HTML/SVG (DOMPurify) et éviter les mismatches d'hydratation SSR/client.

### En production (`prod-server.js`)

```
SITE_CONFIG_JSON       →  parse direct
        ↓ (absent)
SITE_CONFIG_PATH       →  lecture fichier
        ↓ (absent)
dist/site-config.json  →  config figée au build par SITE_EMBED
        ↓ (absent)
VITE_SLUG + sites.json →  lookup (hors conteneur uniquement)
        ↓ (absent)
Erreur de démarrage  →  arrêt immédiat, message énumérant les quatre voies
```

- Le niveau 3 n'existe que si l'image a été construite avec `SITE_EMBED=true` (voir [Déploiement Docker](16-deploiement-docker.md)). C'est une copie conforme du fichier source, lue et normalisée exactement comme au niveau 2.
- Le niveau 4 ne peut pas se déclencher dans un conteneur : l'étape runner du Dockerfile ne copie ni `sites.json` ni les `config.prod.*.json`. Il sert au lancement depuis le dépôt (`npm start`) et donne la parité avec le serveur de développement.
- La config est chargée **une seule fois** au démarrage, normalisée et mise en cache. Il n'y a pas de hot-reload en production.

---

## Fichiers JSON de configuration

### Fichiers disponibles

Les fichiers `config.prod.*.json` présents à la racine du dépôt :

| Fichier | Description |
| ------- | ----------- |
| `config.prod.json` | Config de production par défaut |
| `config.prod.tiers-lieux.json` | Navigator des Tiers-Lieux |
| `config.prod.rezo-la-mer.json` | Rezo la Mer |
| `config.prod.cyber-reunion.json` | Cyber Réunion (aussi utilisée par le slug `cocolight`) |
| `config.prod.sport-sante-bien-etre.json` | Sport Santé Bien-Être |
| `config.prod.nos-commune.json` | Nos Communes |
| `config.prod.commune-transparente.json` | Commune Transparente (partagée par plusieurs slugs communes) |
| `config.prod.julie-pot-vin.json` | Julie Pot Vin |
| `config.prod.institut-bleu.json` | Institut Bleu |
| `config.prod.equipements-Sportifs.json` | Équipements Sportifs 974 |
| `config.prod.eXtremeDefiAdeme.json` | eXtrème Défi Ademe |
| `config.dev.json` | Config de développement |
| `site-config.json` | Config alternative |

### Structure d'un fichier config

Tous les fichiers doivent être conformes au `SiteConfigSchema` défini dans `src/types/site-schema.ts` et validé par Zod :

```json
{
  "meta": {
    "title": { "fr": "SiteForge", "en": "SiteForge" },
    "description": { "fr": "Générateur JSON", "en": "JSON Site Generator" }
  },
  "header": {
    "nav": [ /* … */ ],
    "logoSize": "sm",
    "utilities": { "themeSwitch": true, "auth": true, "piggyBank": false }
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
        }
        /* … */
      ]
    }
    /* … */
  ]
}
```

#### Taille du logo (`header.logoSize`)

`header.logoSize` (enum `"sm"` | `"md"` | `"lg"`, optionnel, défaut `"sm"`) contrôle la taille du logo dans la barre. Le défaut `"sm"` reproduit le comportement historique de chaque header. Les classes responsive (toujours plus compactes en mobile, taille pleine dès `sm:`) sont centralisées dans `src/components/layout/header/logoSize.ts` et honorées par les 6 variantes de header (`HeaderMegaMenu`, `HeaderMinimal`, `HeaderStandard`, `HeaderTransparentDark`, `HeaderTransparentScroll`, `HeaderUnderlineNav`).

| Valeur | Hauteur desktop (hint px optimiseur) |
| ------ | ------------------------------------ |
| `sm` | 32 px |
| `md` | 40 px |
| `lg` | 48 px |

> Sur `HeaderStandard`, un logo `"lg"` (48 px) suppose `header.height: "md"` ou `"lg"` (la barre `"sm"` fait 48 px).

#### Utilitaires du header (`header.utilities`)

Le bloc `header.utilities` active des widgets dans la barre (tous des booléens `default false` sauf `themeSwitch`/`langSwitch` à `true`) : `themeSwitch`, `langSwitch`, `search`, `auth`, `cart`, `notifications` et **`piggyBank`** (bouton cagnotte). Voir le schéma `src/types/site-schema.ts` (`Header.utilities`) et le bloc optionnel `header.piggyBank` (`amount`, `icon`, `path`).

#### Pages d'authentification

La config de base SiteForge (`config.prod.json`) déclare les pages d'authentification comme des **pages/sections classiques** (le bloc racine `auth` a été retiré). Chaque page porte `middleware: ["redirect-if-authenticated"]`, `seo.noIndex: true` et une seule section :

| Page | Type de section |
| ---- | --------------- |
| `/login` | `loginForm` |
| `/register` | `registerForm` |
| `/recover-password` | `recoverPasswordForm` |

### Mécanisme `sites.json`

`sites.json` est le registre multi-site : il associe chaque `slug` à un fichier de config et à un fichier CSS. Il est lu par :
- `dev-server.js` (résolution config au démarrage)
- `vite.config.ts` via `siteCssPlugin()` (résolution CSS au build)

Entrées actuelles de `sites.json` :

| Slug | Config | CSS |
| ---- | ------ | --- |
| `cyberReunion` | `config.prod.cyber-reunion.json` | `index-cyber-reunion` |
| `cocolight` | `config.prod.cyber-reunion.json` | `index-cyber-reunion` |
| `rezoLaMer` | `config.prod.rezo-la-mer.json` | `index-rezo-la-mer` |
| `eXtremeDefiAdeme` | `config.prod.eXtremeDefiAdeme.json` | `index-extreme-defi` |
| `sportSanteBienetre` | `config.prod.sport-sante-bien-etre.json` | `index-sport-sante-bien-etre` |
| `institutBleu` | `config.prod.institut-bleu.json` | `index-institut-bleu` |
| `navigatorDesTierslieux` | `config.prod.tiers-lieux.json` | `index-tiers-lieux` |
| `juliePotVin` | `config.prod.julie-pot-vin.json` | `index-julie-pot-vin` |
| `nosCommunes` | `config.prod.nos-commune.json` | `index-nos-communes` |
| `etangsale1` | `config.prod.commune-transparente.json` | `index-commune-transparente` |
| `tampon` | `config.prod.commune-transparente.json` | `index-commune-transparente` |
| `saintbenoit4` | `config.prod.commune-transparente.json` | `index-commune-transparente` |
| `saintemarie1` | `config.prod.commune-transparente.json` | `index-commune-transparente` |
| `saintpaul4` | `config.prod.commune-transparente.json` | `index-commune-transparente` |
| `saintJoseph` | `config.prod.commune-transparente.json` | `index-commune-transparente` |
| `equipementsSportifs974` | `config.prod.equipements-Sportifs.json` | `index-equipements-sportifs` |

> Plusieurs slugs peuvent pointer vers le même fichier de config ou de CSS (ex. les communes partagent toutes `config.prod.commune-transparente.json`).

### Hot-reload config (dev uniquement)

En développement, une fois la config chargée et `SITE_CONFIG_PATH` résolu (que ce soit par `SITE_CONFIG_PATH` direct ou par la résolution `VITE_SLUG` → `sites.json`), le serveur surveille le fichier avec `fs.watchFile` (intervalle 500 ms). Toute modification est :

1. Rechargée et ré-normalisée en mémoire (`cachedConfig`)
2. Envoyée aux clients via le WebSocket Vite (`event: "config-update"`)

Le serveur écoute aussi l'événement WebSocket `"config-save"` (envoyé par l'interface d'administration) pour écrire directement les modifications dans le fichier config.

> Ce mécanisme ne fonctionne que si `SITE_CONFIG_PATH` est défini. Si la config provient de `SITE_CONFIG_JSON`, le hot-reload est désactivé.

Voir [Backend et SSR](14-backend-ssr.md) pour les détails techniques.

---

## Résolution CSS (`virtual:site-css`)

Le plugin `siteCssPlugin()` dans `vite.config.ts` expose un module virtuel `virtual:site-css` importé par l'entry point. La résolution suit 4 niveaux de priorité (évalués au démarrage de Vite) :

```
1. SITE_CSS_CONTENT  →  contenu CSS inline écrit dans src/.tmp-site-theme.css
         ↓ (absent)
2. SITE_CSS_PATH  →  chemin de fichier CSS explicite (absolu ou relatif à la racine)
         ↓ (absent ou fichier introuvable)
3. VITE_SLUG + sites.json  →  src/{site.css}.css  (ex. src/index-tiers-lieux.css)
         ↓ (slug absent, non trouvé, ou fichier CSS absent)
4. Fallback  →  src/index.css  (thème par défaut)
```

- `SITE_CSS_CONTENT` est l'option recommandée pour CI/CD et builds Docker sans fichier CSS dans le dépôt.
- Si `SITE_CSS_PATH` pointe vers un fichier inexistant, le plugin émet un warning et passe au niveau suivant.
- Si le slug `sites.json` est trouvé mais que le fichier `src/{site.css}.css` n'existe pas, le plugin émet un warning et utilise `src/index.css`.

---

## Fichier de configuration Vite (`vite.config.ts`)

Vite est configuré pour supporter :

* **Alias** : `@` → `./src`
* **Plugins** :
  - `siteCssPlugin()` : plugin custom de résolution CSS virtuelle (`virtual:site-css`). Voir section [Résolution CSS](#résolution-css-virtualsite-css) ci-dessus.
  - `preloadPlugin()` (de `vite-preload`) : trace les imports lazy pour générer les balises `<link rel="modulepreload">` en SSR. Doit être **avant** `react()` pour tracer les lazy imports
  - `react()` : support React avec JSX automatique
  - `tailwindcss()` : compilation Tailwind CSS 4
  - `visualizer()` (de `rollup-plugin-visualizer`) : génère `stats.html` à la racine du dépôt pour l'analyse de bundle (uniquement pour le build client, absent du build SSR). Volontairement **hors de `dist/`** : le Dockerfile copie `dist/` en entier dans l'image de production, où ce rapport de ~4 Mo n'a rien à faire. Fichier gitignoré.
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
  - En **dev** (`isSsrBuild: false/undefined`) : `noExternal` n'est pas défini ; seuls `@communecter/cocolight-api-client`, `pino` et `pino-pretty` sont externalisés. Le `ssr.noExternal` local du `dev-server.js` surcharge ce comportement pour `@radix-ui/*` et `lucide-react` (traitement inline en mode dev).
* **Server warmup** : pré-charge les fichiers SSR et client au démarrage du serveur de dev :

  ```ts
  server: {
    warmup: {
      ssrFiles: ['./src/entry-server.tsx'],
      clientFiles: ['./src/entry-client.tsx'],
    },
  },
  ```

  > Ce warmup Vite est **asynchrone non-bloquant**. `dev-server.js` effectue en plus un warmup bloquant (`await vite.ssrLoadModule("/src/entry-server.tsx")`) au démarrage pour garantir que le premier hit utilisateur reçoit un rendu SSR complet.

* **`optimizeDeps`** : `lucide-react` est exclu du pre-bundling en dev (les icônes individuelles sont tree-shakées).
* **Build manifest** : `build.manifest: true` génère le manifest JSON utilisé par `vite-preload` pour les balises `<link rel="modulepreload">`.
* **`manualChunks`** : stratégie de découpage pour le build client uniquement. Voir [Architecture — Bundle](03-architecture.md) pour le détail des chunks.

---

## Voir aussi

- [Introduction & Installation](01-introduction-installation.md)
- [Architecture](03-architecture.md)
- [Backend et SSR](14-backend-ssr.md)
