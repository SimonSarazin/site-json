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
  - [Recapitulatif du flux build / runtime](#recapitulatif-du-flux-build--runtime)
  - [Voir aussi](#voir-aussi)

---

## Dockerfile — Build multi-stage

Le Dockerfile utilise deux etapes :

**Etape 1 (builder)** : compile le client et le serveur SSR. Le CSS est determine au build par les arguments `SITE_CSS_CONTENT`, `SITE_CSS_PATH` ou `VITE_SLUG`.

**Etape 2 (runner)** : image de production legere contenant uniquement le build et les dependances runtime. Les dependances installees sont : `express@5`, `compression`, `serialize-javascript`, `isomorphic-dompurify`, `@communecter/cocolight-api-client`, `sharp`, `multer`, `react`, `react-dom`.

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
| `SITE_CONFIG_PATH` | oui* | Chemin vers le fichier JSON de configuration du site | — |
| `SITE_CONFIG_JSON` | oui* | Alternative : JSON complet de la config inline | — |
| `VITE_BASE_URL_BACKEND` | non | URL du backend API, injectee dans `window.__ENV__` | `""` |
| `VITE_SERVER_URL` | non | URL publique du serveur, injectee dans `window.__ENV__` | `""` |
| `VITE_SLUG` | non | Slug du site, injecte dans `window.__ENV__` (utilise cote client) | `""` |
| `IMAGE_OPTIMIZER_ALLOWED_DOMAINS` | non | Domaines autorises pour le proxy d'images, separes par des virgules | localhost + hostname du backend |
| `NODE_ENV` | non | Mode Node.js | `production` |
| `PORT` | non | Port d'ecoute du serveur | `80` |

> \* L'un des deux (`SITE_CONFIG_PATH` ou `SITE_CONFIG_JSON`) est obligatoire. Sans configuration, le serveur refuse de demarrer.

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
      SITE_CONFIG_PATH: "./config.prod.json"
      VITE_BASE_URL_BACKEND: "https://www.communecter.org"
      VITE_SERVER_URL: "https://www.communecter.org"
      VITE_SLUG: "franceTierslieux"
    volumes:
      # Config JSON (obligatoire)
      - ./config.prod.json:/app/config.prod.json
      # Cache d'images optimisees (persistant)
      - image-cache:/app/.cache/images

volumes:
  image-cache:
```

## Recapitulatif du flux build / runtime

```
BUILD (docker build)                        RUNTIME (docker run)
────────────────────                        ────────────────────
ARG SITE_CSS_CONTENT ──┐                    ENV SITE_CONFIG_PATH ──→ prod-server.js
ARG SITE_CSS_PATH ─────┼→ Vite/Tailwind    ENV VITE_BASE_URL_BACKEND ──→ window.__ENV__
ARG VITE_SLUG ─────────┘   compile CSS     ENV VITE_SERVER_URL ──→ window.__ENV__
(sinon src/index.css)       │               ENV VITE_SLUG ──→ window.__ENV__
                            ▼
               dist/client/assets/*.css     Volume config.json ──→ loadSiteConfig()
               (fige dans l'image)          Volume images/ ──→ express.static
```

---

## Voir aussi

- [Configuration](02-configuration.md)
- [Performance](12-performance.md)
- [Tests](15-tests.md)
