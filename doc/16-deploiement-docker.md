[← Retour à l'index](README.md)

# Déploiement Docker

**Sommaire**

- [Déploiement Docker](#déploiement-docker)
  - [Dockerfile — Build multi-stage](#dockerfile--build-multi-stage)
    - [Arguments de build (ARG)](#arguments-de-build-arg)
    - [Deploiement avec Coolify](#deploiement-avec-coolify)
  - [Variables d'environnement runtime](#variables-denvironnement-runtime)
  - [Volumes](#volumes)
  - [Ajouter des images de contenu en production](#ajouter-des-images-de-contenu-en-production)
  - [Exemple complet docker-compose.yml](#exemple-complet-docker-composeyml)
  - [Comportement du serveur de production](#comportement-du-serveur-de-production)
    - [Compression](#compression)
    - [Politique de cache HTTP](#politique-de-cache-http)
    - [Gestion des 404 statiques](#gestion-des-404-statiques)
    - [Routes API HelloAsso](#routes-api-helloasso)
  - [Recapitulatif du flux build / runtime](#recapitulatif-du-flux-build--runtime)
  - [Voir aussi](#voir-aussi)

---

## Dockerfile — Build multi-stage

Le Dockerfile utilise deux etapes (image de base : `node:22-alpine`) :

**Etape 1 (builder)** : compile le client et le serveur SSR. Le CSS est determine au build par les arguments `SITE_CSS_CONTENT`, `SITE_CSS_PATH` ou `VITE_SLUG`. La commande `npm run build` execute d'abord un `clean` (suppression de `dist/` et `tsconfig.tsbuildinfo`), puis `build:client` (TypeScript + Vite client) et `build:server` (bundle SSR).

**Etape 2 (runner)** : image de production legere contenant le build et les dependances runtime. Un `package.json` minimal (`{"type":"module"}`) est genere, puis les dependances suivantes sont installees : `express@5`, `compression`, `serialize-javascript`, `isomorphic-dompurify`, `@communecter/cocolight-api-client`, `sharp`, `multer`, `dotenv`, `react`, `react-dom`.

Le repertoire `server/` est copie en entier (pas uniquement `prod-server.js`) car il contient les sous-repertoires `server/api/`, `server/middleware/` et `server/utils/` necessaires a l'execution. `dev-server.js` est inclus dans la copie mais n'est jamais execute en production (le `CMD` lance `prod-server.js`).

### Arguments de build (ARG)

Ces arguments sont utilises uniquement pendant `npm run build` pour determiner quel CSS est bundle :

| Argument | Description | Exemple |
|----------|-------------|---------|
| `SITE_CSS_CONTENT` | Contenu CSS complet inline (pas besoin de fichier dans le repo) | `$(cat mon-theme.css)` |
| `SITE_CSS_PATH` | Chemin direct vers un fichier CSS present dans le contexte de build | `./src/index-cyber-reunion.css` |
| `VITE_SLUG` | Slug du site, resolu via `sites.json` pour trouver le fichier CSS | `franceTierslieux` |

Resolution CSS au build (par ordre de priorite) :

1. `SITE_CSS_CONTENT` → contenu CSS inline, ecrit dans un fichier temporaire et compile par Tailwind
2. `SITE_CSS_PATH` → chemin direct vers un fichier `.css`
3. `VITE_SLUG` → lookup dans `sites.json` → `src/{css}.css`
4. Aucun → `src/index.css` (theme par defaut, neutre noir/blanc)

Exemples :

```bash
# Build avec contenu CSS inline (fichier externe, pas dans le repo)
docker build --build-arg SITE_CSS_CONTENT="$(cat /chemin/externe/theme.css)" -t site-custom .

# Build avec un slug (CSS resolu via sites.json)
docker build --build-arg VITE_SLUG=cyberReunion -t site-cyber .

# Build avec un chemin CSS direct
docker build --build-arg SITE_CSS_PATH=./src/index-cyber-reunion.css -t site-cyber .

# Build sans argument → theme par defaut (src/index.css)
docker build -t site-default .
```

> **Important** : le CSS est fige dans le build. Changer de theme necessite un rebuild de l'image.

### Deploiement avec Coolify

Dans Coolify, les arguments de build se configurent comme des variables d'environnement avec l'option **"Build Variable"** cochee :

1. Ajouter la variable (ex: `SITE_CSS_CONTENT` ou `VITE_SLUG`)
2. Coller la valeur (le contenu CSS complet, ou le slug)
3. Cocher **"Build Variable"** / **"Available at build time"**

Les variables runtime (`SITE_CONFIG_PATH`, `VITE_BASE_URL_BACKEND`, etc.) ne doivent **pas** etre cochees comme build variables — elles sont lues au demarrage du conteneur.

## Variables d'environnement runtime

Ces variables sont lues par `prod-server.js` au demarrage du conteneur. Elles sont toutes surchargeables via `docker run -e` ou `docker-compose.yml > environment`.

| Variable | Obligatoire | Description | Valeur par defaut |
|----------|-------------|-------------|-------------------|
| `SITE_CONFIG_PATH` | oui* | Chemin vers le fichier JSON de configuration du site. Les chemins relatifs sont resolus depuis `process.cwd()` (le repertoire de travail du processus, `/app` dans le conteneur). | — |
| `SITE_CONFIG_JSON` | oui* | Alternative : JSON complet de la config inline | — |
| `VITE_BASE_URL_BACKEND` | non | URL du backend API, injectee dans `window.__ENV__` | `""` |
| `VITE_SERVER_URL` | non | URL publique du serveur, injectee dans `window.__ENV__` | `""` |
| `VITE_SLUG` | non | Slug du site, injecte dans `window.__ENV__` (utilise cote client) | `""` |
| `IMAGE_OPTIMIZER_ALLOWED_DOMAINS` | non | Domaines autorises pour le proxy d'images, separes par des virgules | localhost + hostname du backend |
| `NODE_ENV` | non | Mode Node.js | `production` |
| `PORT` | non | Port d'ecoute du serveur | `3000` |

> \* L'un des deux (`SITE_CONFIG_PATH` ou `SITE_CONFIG_JSON`) est obligatoire. Sans configuration, le serveur refuse de demarrer.

> **Note `window.__ENV__`** : le bloc `window.__ENV__` n'est injecte dans le HTML que si au moins une des trois variables (`VITE_BASE_URL_BACKEND`, `VITE_SERVER_URL`, `VITE_SLUG`) est definie. Si aucune n'est renseignee, aucun script `__ENV__` n'est emis.

## Volumes

| Volume | Chemin dans le conteneur | Description |
|--------|--------------------------|-------------|
| Config JSON | `/app/config.prod.json` (ou autre chemin) | Fichier de configuration du site, monte depuis l'hote via bind mount. Doit correspondre a `SITE_CONFIG_PATH`. |
| Cache images | `/app/.cache/images` | Cache des images optimisees par le middleware sharp. Volume nomme, persiste entre les redemarrages pour eviter de re-optimiser. |

## Ajouter des images de contenu en production

Les images presentes dans le code source au moment du build sont incluses dans `dist/client/`. Pour ajouter des images **apres le build** (logo, photos, visuels de contenu...), il faut monter un dossier local dans le conteneur.

Le dossier monte doit correspondre au chemin utilise dans la config JSON. Par exemple, si la config reference `/images/mon-site/logo.png`, il faut monter un dossier contenant `logo.png` sur `/app/dist/client/images/mon-site` :

```yaml
volumes:
  - ./mes-images:/app/dist/client/images/mon-site
```

```
# Structure sur l'hote
./mes-images/
  ├── logo.png
  ├── hero-banner.jpg
  └── partenaires/
      └── logo-region.png
```

Les images sont immediatement disponibles sans rebuild ni restart du conteneur (`express.static` les sert directement).

Plusieurs dossiers peuvent etre montes si necessaire :

```yaml
volumes:
  - ./images-site:/app/dist/client/images/mon-site
  - ./images-partenaires:/app/dist/client/images/partenaires
```

> **Attention** : ne pas monter directement sur `/app/dist/client/images/` car cela masquerait les images deja presentes dans le build. Toujours monter un **sous-dossier**.

## Exemple complet docker-compose.yml

Le `docker-compose.yml` du depot est directement utilisable :

```yaml
version: "3.8"

services:
  cocostum:
    build:
      context: .
      args:
        VITE_SLUG: "franceTierslieux"
    ports:
      - "3000:3000"
    environment:
      VITE_BASE_URL_BACKEND: "https://www.communecter.org"
      VITE_SERVER_URL: "https://www.communecter.org"
      VITE_SLUG: "franceTierslieux"
      SITE_CONFIG_PATH: "./config.prod.json"
    volumes:
      - ./config.prod.json:/app/config.prod.json
      - image-cache:/app/.cache/images

volumes:
  image-cache:
```

> **Port** : le Dockerfile declare `EXPOSE 80` mais `prod-server.js` ecoute sur `process.env.PORT || 3000`. Le port expose dans `docker-compose.yml` est `3000:3000`. Pour ecouter sur le port 80 sans reverse proxy, definir `PORT=80` dans les variables d'environnement.

## Comportement du serveur de production

### Compression

`prod-server.js` applique la compression gzip avec les options suivantes :

- `level: 6` — compromis vitesse/taux de compression
- `threshold: 1024` — les reponses inferieures a 1 Ko ne sont pas compressees

### Politique de cache HTTP

| Chemin | Cache-Control | Justification |
|--------|---------------|---------------|
| `/assets/*` | `public, max-age=31536000, immutable` | Assets Vite avec hash de contenu — jamais changes |
| `/images/*` | `public, max-age=86400, stale-while-revalidate=604800` | Images statiques servies depuis `dist/client/images/` |
| Autres statiques | ETag + Last-Modified | Geres par `express.static` |

Un ETag fort (`app.set('etag', 'strong')`) est active globalement pour permettre les reponses `304 Not Modified`.

### Gestion des 404 statiques

Les requetes vers des extensions de fichiers statiques inexistants (`.png`, `.jpg`, `.css`, `.js`, `.json`, `.ico`, `.webp`, `.mp4`, `.woff2`, `.woff`, etc.) retournent un 404 immediat sans passer par le rendu SSR. Les routes `/api/*` sont exemptees de cette verification.

### Routes API HelloAsso

`prod-server.js` enregistre quatre routes pour l'integration HelloAsso (paiement) :

| Methode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/helloasso/token` | Obtention du token OAuth HelloAsso |
| `POST` | `/api/helloasso/checkout-intent` | Creation d'une intention de paiement |
| `GET` | `/api/helloasso/callback` | Callback apres paiement |
| `GET` | `/api/helloasso/checkout-status/:checkoutIntentId` | Statut d'un paiement |

Ces routes sont servies directement par Express avant le rendu SSR. Elles requierent que les variables d'environnement HelloAsso soient configurees dans le conteneur (voir la documentation du module `cagnotte`).

## Recapitulatif du flux build / runtime

```
BUILD (docker build)                        RUNTIME (docker run / docker-compose)
────────────────────                        ──────────────────────────────────────
ARG SITE_CSS_CONTENT ──┐                    ENV SITE_CONFIG_PATH ──→ loadSiteConfig()
ARG SITE_CSS_PATH ─────┼→ Vite/Tailwind    ENV SITE_CONFIG_JSON ──→ loadSiteConfig()
ARG VITE_SLUG ─────────┘   compile CSS     ENV VITE_BASE_URL_BACKEND ─┐
(sinon src/index.css)       │               ENV VITE_SERVER_URL ────────┼→ window.__ENV__
                            ▼               ENV VITE_SLUG ──────────────┘  (si ≥ 1 defini)
               dist/client/assets/*.css
               dist/server/entry-server.js  ENV PORT ──→ port d'ecoute (defaut : 3000)
               server/ (prod-server.js      ENV IMAGE_OPTIMIZER_ALLOWED_DOMAINS
                        api/, middleware/,         ──→ proxy /img
                        utils/)
                                            Volume config.json ──→ loadSiteConfig()
npm run build =                             Volume images/ ──→ express.static
  rimraf dist                               Volume .cache/images ──→ cache sharp
  + tsc -b + vite build (client)
  + vite build --ssr (server)               Routes API : /api/helloasso/* (HelloAsso)
                                            Cache : /assets/* immutable 1 an
                                                    /images/* 1 jour + SWR 7 jours
                                            Compression gzip : level 6, threshold 1 Ko
```

---

## Voir aussi

- [Configuration](02-configuration.md)
- [Performance](12-performance.md)
- [Tests](15-tests.md)
