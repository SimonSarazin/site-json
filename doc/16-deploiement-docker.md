[← Retour à l'index](README.md)

# Déploiement Docker

**Sommaire**

- [Déploiement Docker](#déploiement-docker)
  - [Dockerfile — Build multi-stage](#dockerfile--build-multi-stage)
      - [Arguments de build (ARG)](#arguments-de-build-arg)
    - [Deploiement avec Coolify](#deploiement-avec-coolify)
  - [Verifier un build : `npm run verify:build`](#verifier-un-build--npm-run-verifybuild)
  - [Piloter les deploiements depuis le depot](#piloter-les-deploiements-depuis-le-depot)
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

**Etape 1 (builder)** : compile le client et le serveur SSR. La commande `npm run build` execute d'abord un `clean` (suppression de `dist/` et `tsconfig.tsbuildinfo`), puis `build:client` (TypeScript + Vite client) et `build:server` (bundle SSR). Les arguments de build determinent ce que le resultat embarque : le CSS (`SITE_CSS_CONTENT`, `SITE_CSS_PATH` ou `VITE_SLUG`), les dossiers d'images (`SITE_IMAGES`) et, le cas echeant, la configuration du site (`SITE_EMBED`). Voir [Arguments de build](#arguments-de-build-arg).

Le build SSR **ne recopie pas** `public/` : `build.copyPublicDir` vaut `!isSsrBuild` dans `vite.config.ts`. `dist/server/` ne contient donc que `entry-server.js` et ses chunks — `prod-server` n'y lit rien d'autre, et `express.static` comme l'optimiseur d'images pointent sur `dist/client`.

**Etape 2 (runner)** : image de production legere contenant le build et les dependances runtime. Un `package.json` minimal (`{"type":"module"}`) est genere, puis les dependances suivantes sont installees : `express@5`, `compression`, `serialize-javascript`, `isomorphic-dompurify`, `@communecter/cocolight-api-client`, `sharp`, `multer`, `dotenv`, `react`, `react-dom`.

Le repertoire `server/` est copie en entier (pas uniquement `prod-server.js`) car il contient les sous-repertoires `server/api/`, `server/middleware/` et `server/utils/` necessaires a l'execution. `dev-server.js` est inclus dans la copie mais n'est jamais execute en production (le `CMD` lance `prod-server.js`).

### Arguments de build (ARG)

Ces arguments determinent ce que le build embarque dans l'image. Ils sont tous facultatifs : sans aucun d'eux, le build produit exactement ce qu'il produisait avant leur introduction.

| Argument | Determine | Exemple |
|----------|-----------|---------|
| `SITE_CSS_CONTENT` | le CSS (contenu inline, pas besoin de fichier dans le repo) | `$(cat mon-theme.css)` |
| `SITE_CSS_PATH` | le CSS (chemin dans le contexte de build) | `./src/index-institut-bleu.css` |
| `VITE_SLUG` | le CSS, resolu via `sites.json` | `institutBleu` |
| `SITE_IMAGES` | les dossiers de `public/images/` embarques | `institutBleu` |
| `SITE_EMBED` | si la config est figee dans l'image | `true` |
| `SITE_CONFIG_PATH` | la config a figer (avec `SITE_EMBED`) | `./config.prod.institut-bleu.json` |
| `SITE_CONFIG_JSON` | la config a figer, en inline (avec `SITE_EMBED`) | — |

> Ces `ARG` sont declares dans le Dockerfile, et ils doivent l'etre : Docker **ignore silencieusement** un `--build-arg` qu'aucun `ARG` ne declare. Sans eux, une variable cochee « Build Variable » dans Coolify n'atteindrait jamais le build.

#### CSS

Resolution par ordre de priorite :

1. `SITE_CSS_CONTENT` → contenu inline, ecrit dans un fichier temporaire et compile par Tailwind
2. `SITE_CSS_PATH` → chemin direct vers un fichier `.css`
3. `VITE_SLUG` → lookup dans `sites.json` → `src/{css}.css`
4. Aucun → `src/index.css` (theme par defaut, neutre noir/blanc)

#### Images

`public/images/` contient un dossier par site (13 aujourd'hui, ~40 Mo), tous recopies dans l'image. `SITE_IMAGES` restreint la copie aux dossiers nommes.

Il prend un **nom de dossier**, pas un chemin, et accepte une liste separee par des virgules. Le nom ne suit pas le slug — `navigatorDesTierslieux` utilise `tiersLieux`, et six slugs communaux partagent `communeTransparente` — il se lit dans le champ `images` de `sites.json`.

Seuls les **sous-dossiers directs** de `public/images/` sont filtres. Tout le reste de `public/` est copie tel quel, ce qui conserve automatiquement `defaultImage.png`, `marker-icon.png`, `marker-shadow.png` et `france-regions.geojson` — ce sont des fichiers, pas des dossiers.

Trois cas de repli, tous en **no-op avec un message** plutot qu'en erreur, parce qu'un site sans visuels se deploie sans rien casser : argument absent, dossier nomme introuvable, `public/images/` inexistant.

```
[site-images] institutBleu (1.0 Mo) — 12 dossier(s) écarté(s) (37.2 Mo)
[site-images] "institutbleu" introuvable(s) dans public/images/ → aucun filtrage
              disponibles : institutBleu, cyberReunion, parent62, tiersLieux, …
```

#### Config

`SITE_EMBED=true` fait resoudre la config **au build** (`SITE_CONFIG_JSON` puis `SITE_CONFIG_PATH`) et l'ecrit dans `dist/site-config.json`, que `prod-server` lit au niveau 3. Le conteneur n'a alors plus besoin ni de volume ni de `SITE_CONFIG_PATH`.

Le drapeau est necessaire parce que `SITE_CONFIG_PATH` et `SITE_CONFIG_JSON` ont **deja un sens a l'execution** : les consommer au build sur simple presence changerait le comportement de tous les deploiements existants en silence.

Le fichier produit est une **copie conforme** de sa source — ni normalisation, ni metadonnee ajoutee. Il reste une `SiteConfig` valide, comparable par `diff` et validable par `npm run config:validate`. Il est ecrit a la racine de `dist/`, jamais dans `dist/client/` (que `express.static` sert publiquement) ni dans `dist/server/` (que le build SSR viderait ensuite).

Aucun repli : si ni `SITE_CONFIG_JSON` ni `SITE_CONFIG_PATH` n'est fourni, ou si le fichier est introuvable, **rien n'est fige** et `prod-server` retombe sur ses niveaux 1 et 2. Figer une config arbitraire serait pire que ne rien figer.

Exemples :

```bash
# Image mono-site autonome : CSS, config et images du seul institutBleu
docker build \
  --build-arg VITE_SLUG=institutBleu \
  --build-arg SITE_CSS_PATH=./src/index-institut-bleu.css \
  --build-arg SITE_IMAGES=institutBleu \
  --build-arg SITE_CONFIG_PATH=./config.prod.institut-bleu.json \
  --build-arg SITE_EMBED=true \
  -t institut-bleu .

# Les memes variables peuvent etre repassees au run (cas Coolify) : seule
# SITE_CONFIG_PATH y a un sens, et elle bascule sur la config figee.
docker run -p 3000:3000 \
  -e VITE_SLUG=institutBleu \
  -e VITE_BASE_URL_BACKEND=https://www.communecter.org \
  -e VITE_SERVER_URL=https://www.communecter.org \
  institut-bleu

# Build avec contenu CSS inline (fichier externe, pas dans le repo)
docker build --build-arg SITE_CSS_CONTENT="$(cat /chemin/externe/theme.css)" -t site-custom .

# Build avec un slug (CSS resolu via sites.json)
docker build --build-arg VITE_SLUG=cyberReunion -t site-cyber .

# Build sans argument → theme par defaut, toutes les images, config au runtime
docker build -t site-default .
```

> **Important** : ce que le build embarque y est fige. Changer de theme, d'images ou de config figee necessite un rebuild. La config reste toutefois surchargeable au runtime (niveaux 1 et 2, prioritaires).

### Deploiement avec Coolify

Dans Coolify, les arguments de build se configurent comme des variables d'environnement avec l'option **"Build Variable"** cochee :

1. Ajouter la variable (ex: `SITE_IMAGES` ou `VITE_SLUG`)
2. Coller la valeur
3. Cocher **"Build Variable"** / **"Available at build time"**

Le contexte de build est le clone git : `.env`, `dist/`, `node_modules/` et `.cache/` y sont absents (gitignores), tandis que `sites.json` et les `config.prod.*.json` y sont presents et directement resolvables.

**Deploiement mono-site** (une image autonome, sans file mount) — les variables a declarer :

| Variable | Exemple | Build Variable |
|----------|---------|:--------------:|
| `VITE_SLUG` | `institutBleu` | ✓ |
| `SITE_CSS_PATH` | `./src/index-institut-bleu.css` | ✓ |
| `SITE_IMAGES` | `institutBleu` | ✓ |
| `SITE_CONFIG_PATH` | `./config.prod.institut-bleu.json` | ✓ |
| `SITE_EMBED` | `true` | ✓ |
| `VITE_BASE_URL_BACKEND` | `https://www.communecter.org` | — |
| `VITE_SERVER_URL` | `https://www.communecter.org` | — |
| `VITE_MAPTILER_API_KEY` | *(optionnel)* | — |

Les trois valeurs de site se lisent dans `sites.json` : `css` pour `SITE_CSS_PATH` (prefixe `./src/`, suffixe `.css`), `images` pour `SITE_IMAGES`, `config` pour `SITE_CONFIG_PATH`.

> **Coolify pousse le meme jeu de variables au build ET au run.** Trois d'entre elles n'ont aucun sens a l'execution et sont simplement ignorees par `prod-server` : `SITE_CSS_PATH`, `SITE_IMAGES`, `SITE_EMBED`.
>
> La quatrieme, `SITE_CONFIG_PATH`, en a un — c'est le niveau 2 de la resolution. Au runtime elle pointe un fichier **absent de l'image** (l'etape runner ne copie ni `sites.json` ni les `config.prod.*.json`). `prod-server` bascule alors sur `dist/site-config.json` en l'annoncant :
>
> ```
> [config] SITE_CONFIG_PATH "./config.prod.institut-bleu.json" introuvable depuis /app
>          — bascule sur dist/site-config.json, figée au build.
> Config chargée depuis dist/site-config.json : Institut Bleu …
> ```
>
> Le message est volontairement bruyant : dans un deploiement a volume, un chemin errone doit rester visible. Si le fichier existe mais est illisible ou invalide, le serveur refuse toujours de demarrer.

Le **file mount de la config devient inutile** : le fichier est deja dans le clone, le remonter a la main en cree un double qui peut diverger. Contrepartie : la config se met alors a jour par commit et redeploiement, plus par edition du fichier monte. Si des retouches a chaud sont necessaires, garder le file mount — un `SITE_CONFIG_PATH` qui **resout** reste prioritaire sur la config figee.

**Deploiement historique** : ne rien cocher d'autre que `VITE_SLUG` et garder `SITE_CONFIG_PATH` avec son volume. Le comportement est strictement inchange.

## Verifier un build : `npm run verify:build`

Le depot n'a ni CI, ni healthcheck Docker, ni test qui execute `prod-server` ou lise `dist/` — les tests d'integration et E2E passent tous par le serveur de developpement. Le mode d'echec « le build a produit le mauvais site » n'est donc detectable qu'a l'œil, en production.

`scripts/verify-build.ts` comble ce trou. Il se lance **avec les memes variables que le build** :

```bash
VITE_SLUG=institutBleu SITE_IMAGES=institutBleu SITE_EMBED=true \
  SITE_CONFIG_PATH=./config.prod.institut-bleu.json \
  npm run build && npm run verify:build
```

Il controle cinq choses, et sort en code 1 au premier ecart :

| Controle | Detecte |
|----------|---------|
| `dist/client/index.html` present | build client interrompu |
| `dist/server/` sans copie de `public/` | regression de `copyPublicDir` |
| `dist/client/images/` ne contient que les dossiers demandes | elagage non applique (nom errone → no-op) ou mauvais dossier |
| `dist/site-config.json` identique a sa source et valide Zod | mauvaise config figee, ou config corrompue |
| le CSS bundle porte un selecteur exclusif du theme attendu, et d'aucun autre | mauvais theme bundle |

Le controle CSS repose sur les classes sur-mesure de chaque `src/index-*.css` — en kebab-case dans tout le depot (`releve-eyebrow`, `trait-cote`, `p62-bubble`), ce qui les distingue des utilitaires Tailwind homonymes (`fixed`, `active`, `marker`). Six themes sur treize n'ont aucune classe sur-mesure : leur habillage vient entierement des tokens de `config.theme` injectes au runtime. Pour ceux-la le controle CSS est explicitement **saute**, jamais passe en silence — c'est alors le controle de la config qui distingue le site.

## Variables d'environnement runtime

Ces variables sont lues par `prod-server.js` au demarrage du conteneur. Elles sont toutes surchargeables via `docker run -e` ou `docker-compose.yml > environment`.

| Variable | Obligatoire | Description | Valeur par defaut |
|----------|-------------|-------------|-------------------|
| `SITE_CONFIG_PATH` | oui* | Chemin vers le fichier JSON de configuration du site. Les chemins relatifs sont resolus depuis `process.cwd()` (le repertoire de travail du processus, `/app` dans le conteneur). | — |
| `SITE_CONFIG_JSON` | oui* | Alternative : JSON complet de la config inline | — |
| `VITE_SLUG` | non | Slug du site. Injecte dans `window.__ENV__` et utilise cote client pour resoudre l'entite Cocolight. Sert aussi de dernier repli pour la config, mais **uniquement hors conteneur** : l'image ne contient pas `sites.json`. | `""` |
| `VITE_BASE_URL_BACKEND` | non | URL du backend API, injectee dans `window.__ENV__` | `""` |
| `VITE_SERVER_URL` | non | URL publique du serveur, injectee dans `window.__ENV__` | `""` |
| `VITE_MAPTILER_API_KEY` | non | Cle des fonds de carte MapTiler, injectee dans `window.__ENV__`. Absente : repli sur des tuiles libres. Non versionnee (`SECRETES` de `deploy-config.ts`) mais **pas confidentielle** : comme toute `VITE_*`, elle est lisible dans la page. | `""` |
| `VITE_COSTUM_FORCE_LIVE` | non | Drapeau de depannage costum, injecte dans `window.__ENV__`. A `"true"`, la lib ignore ses schemas costum bundles et ne resout que par `getcostumjson` — a activer quand l'artefact publie devient plus vieux que la base et masque des champs reels. Cout : plus de demarrage a froid. Se pose par site via le champ `env` de `sites.json`. | `"false"` |
| `IMAGE_OPTIMIZER_ALLOWED_DOMAINS` | non | Domaines autorises pour le proxy d'images, separes par des virgules | localhost + hostname du backend |
| `NODE_ENV` | non | Mode Node.js | `production` |
| `PORT` | non | Port d'ecoute du serveur | `3000` |

> \* L'un des deux (`SITE_CONFIG_PATH` ou `SITE_CONFIG_JSON`) est obligatoire **sauf** si l'image a ete construite avec `SITE_EMBED=true` : `dist/site-config.json` prend alors le relais. Sans aucune de ces sources, le serveur refuse de demarrer avec un message enumerant les quatre voies possibles.

Ordre de resolution au demarrage (`server/prod-server.js`) :

| # | Source | Disponible ou |
|---|--------|---------------|
| 1 | `SITE_CONFIG_JSON` | partout |
| 2 | `SITE_CONFIG_PATH` | partout — **prioritaire sur la config figee**, donc utilisable en surcharge. Si le fichier est **absent**, bascule sur le niveau 3 avec un avertissement ; s'il est present mais invalide, echec au demarrage |
| 3 | `dist/site-config.json` | images construites avec `SITE_EMBED=true` |
| 4 | `VITE_SLUG` → `sites.json` | hors conteneur uniquement (`npm start` depuis le depot) |

Le log de demarrage nomme l'origine retenue :

```
Config chargée depuis dist/site-config.json : Institut Bleu — l'économie bleue à La Réunion
```

> **Note dotenv** : `prod-server.js` n'importe pas `dotenv` directement, mais `server/api/helloasso-checkout.js` fait `import "dotenv/config"`. Un fichier `.env` present dans le repertoire de travail est donc lu en production. Sans effet dans l'image Docker (l'etape runner ne copie ni `.env` ni le depot), mais a connaitre pour un `npm start` local : un `SITE_CONFIG_PATH` dans `.env` gagnera sur la config figee.

> **Note `window.__ENV__`** : le bloc `window.__ENV__` n'est injecte dans le HTML que si au moins une des trois variables (`VITE_BASE_URL_BACKEND`, `VITE_SERVER_URL`, `VITE_SLUG`) est definie. Si aucune n'est renseignee, aucun script `__ENV__` n'est emis.

## Volumes

| Volume | Chemin dans le conteneur | Description |
|--------|--------------------------|-------------|
| Config JSON | `/app/config.prod.json` (ou autre chemin) | Fichier de configuration du site, monte depuis l'hote via bind mount. Doit correspondre a `SITE_CONFIG_PATH`. **Inutile si l'image a ete construite avec `SITE_EMBED=true`.** |
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

> **Avec `SITE_IMAGES`** : monter un dossier reste possible et fonctionne a l'identique — l'elagage a lieu au build, le montage au runtime. C'est meme la voie recommandee pour ajouter des visuels sans reconstruire. Attention en revanche a ne pas monter un sous-dossier portant le nom d'un dossier ecarte : il serait servi alors qu'aucune config ne le reference.

## Exemple complet docker-compose.yml

Le `docker-compose.yml` du depot declare deux services, l'un pour chaque mode.

**Mode historique** — la config arrive au runtime par volume :

```yaml
services:
  cocostum:
    build:
      context: .
      args:
        VITE_SLUG: "navigatorDesTierslieux"
    ports:
      - "3000:3000"
    environment:
      VITE_BASE_URL_BACKEND: "https://www.communecter.org"
      VITE_SERVER_URL: "https://www.communecter.org"
      VITE_SLUG: "navigatorDesTierslieux"
      SITE_CONFIG_PATH: "./config.prod.json"
    volumes:
      - ./config.prod.json:/app/config.prod.json
      - image-cache:/app/.cache/images
```

**Mode mono-site** — tout est fige au build, ni volume de config ni `SITE_CONFIG_PATH` :

```yaml
  cocostum-embarque:
    profiles: ["embarque"]
    build:
      context: .
      args:
        VITE_SLUG: "institutBleu"
        SITE_IMAGES: "institutBleu"
        SITE_EMBED: "true"
        SITE_CONFIG_PATH: "./config.prod.institut-bleu.json"
    ports:
      - "3001:3000"
    environment:
      VITE_BASE_URL_BACKEND: "https://www.communecter.org"
      VITE_SERVER_URL: "https://www.communecter.org"
      VITE_SLUG: "institutBleu"
    volumes:
      - image-cache:/app/.cache/images
```

```bash
docker compose --profile embarque up --build
```

> **Slug** : `VITE_SLUG` doit etre un slug present dans `sites.json` pour que le lookup CSS aboutisse. Un slug inconnu ne fait pas echouer le build — il retombe silencieusement sur `src/index.css`.

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
BUILD (docker build)                          RUNTIME (docker run / compose)
────────────────────                          ─────────────────────────────

ARG SITE_CSS_CONTENT ─┐                       loadSiteConfig(), dans l'ordre :
ARG SITE_CSS_PATH ────┼→ CSS bundlé           1  ENV SITE_CONFIG_JSON
ARG VITE_SLUG ────────┘  (sinon index.css)    2  ENV SITE_CONFIG_PATH  ─ prioritaires
                                              ─────────────────────────────────────
ARG SITE_IMAGES ──────→ dist/client/images/   3  dist/site-config.json  (SITE_EMBED)
                        n'a que ces dossiers  4  ENV VITE_SLUG + sites.json
                        (sinon : tous)           (hors conteneur seulement)

ARG SITE_EMBED ───────→ dist/site-config.json ENV VITE_BASE_URL_BACKEND ─┐
  + SITE_CONFIG_PATH    copie conforme        ENV VITE_SERVER_URL ───────┼→ window.__ENV__
  ou SITE_CONFIG_JSON   (sinon : rien)        ENV VITE_SLUG ─────────────┤   (si ≥ 1 défini)
                                              ENV VITE_MAPTILER_API_KEY ─┘
npm run build =
  rimraf dist                                 ENV PORT ──→ écoute (défaut 3000)
  + tsc -b + vite build (client)              ENV IMAGE_OPTIMIZER_ALLOWED_DOMAINS
      → dist/client/  (+ site-config.json)          ──→ proxy /img
  + vite build --ssr (server)
      → dist/server/  SANS public/            Volume .cache/images ──→ cache sharp
        (copyPublicDir: !isSsrBuild)          Volume config.json ──→ inutile si SITE_EMBED
                                              Volume images/ ──→ express.static
stats.html à la racine du dépôt,
hors dist/ (donc hors de l'image)             Routes API : /api/helloasso/*
                                              Cache : /assets/* immutable 1 an
COPY dans le runner : dist/ + server/                 /images/* 1 jour + SWR 7 jours
(ni sites.json ni config.prod.*.json)         Compression gzip : level 6, seuil 1 Ko
```

Ce que pese `dist/` selon les arguments, mesure sur `institutBleu` :

| Arguments | `dist/` |
|-----------|--------:|
| aucun, avant ce dispositif | 122 Mo |
| aucun (le SSR ne recopie plus `public/`) | 79 Mo |
| `SITE_IMAGES` + `SITE_EMBED` | **42 Mo** |

---

## Piloter les deploiements depuis le depot

`scripts/deploy.ts` pilote les applications Coolify du parc. Il part d'un principe : **aucune automatisation implicite**. On nomme ce qu'on deploie, et les deploiements s'enchainent un par un.

### Pourquoi ce parti pris

Coolify ne filtre les webhooks git que sur le couple **(depot, branche)**. Les N applications du parc partagent les deux : un seul push les mettrait **toutes** en file. Et `is_auto_deploy_enabled` vaut `true` par defaut a la creation. Aucun webhook n'existe cote GitLab aujourd'hui, mais `npm run deploy:lock -- --yes` fait qu'ajouter un webhook un jour ne declenchera rien tout seul.

### La source de verite

`sites.json` porte, en plus des champs de build, jusqu'a six champs par site. Tous sont **optionnels** : une entree sans eux est un site pas encore deploye, ce qui est un etat valide.

| Champ | Role |
|-------|------|
| `coolifyApp` | **nom** de l'application Coolify. Pas son UUID : un UUID lierait le depot a une instance et deviendrait faux a la moindre recreation. L'outil resout nom → uuid a chaque execution. |
| `domain` | sous-domaine d'**amorce**, toujours exactement un, dans la zone declaree par `ZONE_AMORCE`. Domaine technique : l'outil cree son CNAME, il ne depend de personne d'autre. |
| `aliases` | domaines **propres** du site. Leur DNS vit ailleurs et se pointe **a la main** en CNAME vers le sous-domaine d'amorce. L'outil ne les cree jamais — il verifie qu'ils resolvent deja avant de les declarer. |
| `coolifyServer` | nom du serveur ou poser le site, quand le parc n'est pas homogene. Absent, il est deduit — voir ci-dessous. |
| `coolifyProject` | idem pour le projet. |
| `build` | surcharge du depot, de la branche, du moteur ou du port pour ce site. Sert au site de recette sur une autre branche, ou repris d'un autre depot. |

Les 5 variables de build ne sont stockees nulle part : elles sont **derivees** de la ligne. Les 2 URLs backend sont des constantes de `scripts/lib/deploy-config.ts`, surchargeables par entree. La cle MapTiler vient de `.env`. Le token Coolify reste dans `~/.config/coolify/config.json`, celui du CLI.

### Ou un site est pose : declare, sinon deduit

`create` determine le serveur et le projet dans cet ordre :

1. **declare** — drapeaux `--server` / `--project` / `--environment`, ou les champs `coolifyServer` / `coolifyProject` de l'entree ;
2. **deduit** du parc, et **seulement s'il est homogene**.

La declaration est la voie normale, et la **seule qui fonctionne sur un serveur ou il n'y a encore rien** : la deduction suppose un voisin, et un serveur neuf n'en a pas. Elle refuse aussi bien sur un parc vide que sur un parc reparti, en indiquant quoi declarer, plutot que de choisir a la place de l'utilisateur.

Ce qui releve du **depot** — depot git, branche, moteur de build, port — ne vient jamais de la : ce sont des constantes de `deploy-config.ts`, justement pour qu'un serveur vide ne soit pas un cas particulier.

### Le DNS suit le serveur, pas l'instance

Chaque serveur Coolify fait tourner **son propre** proxy Traefik, et rien ne route entre eux — c'est [documente par Coolify](https://coolify.io/docs/knowledge-base/server/introduction) : *« Traffic for applications deployed on secondary servers goes directly to those servers, not through the main Coolify server. »* Un domaine pointe vers le mauvais serveur tombe sur le catch-all, qui repond **503**.

La cible DNS est donc declaree **par serveur**, dans `CIBLE_DNS` (`deploy-config.ts`) :

```
localhost → 00.re
```

Pour ajouter un serveur : creer `<nom>.00.re A → son IP` une fois, puis l'inscrire dans la table. Les sites qu'il heberge pointeront ce nom en CNAME, et un changement d'IP ne touchera qu'un enregistrement au lieu de N. Un serveur sans cible fait echouer la commande en disant quoi creer.

L'IP n'est ecrite nulle part : la verification compare deux **resolutions** — le domaine atteint-il la meme adresse que la cible de son serveur. Ca reste juste sans rien savoir, y compris apres un changement d'hebergement. L'API ne permettrait de toute facon pas de s'en sortir seule : elle rend `host.docker.internal` comme IP du serveur local.

### Les commandes

| Commande | Role |
|----------|------|
| `npm run deploy:status` | site ↔ application ↔ domaine ↔ commit deploye. `--json` disponible |
| `npm run deploy:affected` | quels sites les commits non deployes concernent-ils |
| `npm run deploy -- <slug>…` | deploie les sites **nommes**, un par un |
| `npm run deploy:lock` | coupe le deploiement automatique (`--unlock` pour l'inverse) |
| `npm run deploy:env -- <slug>` | compare les 8 variables du site (`--write` pour poser) |
| `npm run deploy:dns -- <slug>` | verifie/cree le CNAME d'amorce chez OVH |
| `npm run deploy:alias -- <slug> <domaine>` | attache un domaine propre, apres verification DNS |
| `npm run deploy:create -- <slug>` | cree l'application d'un site declare |

Rien n'ecrit sans `--yes` (lock, push) ou `--write` (env, dns, alias, create) : sans le drapeau, la commande imprime son plan. `deploy` sans argument **refuse** en code 2 — il ne deploie jamais « tout » implicitement.

Codes de sortie : `0` conforme, `1` le defaut cherche, `2` erreur d'usage ou d'outillage.

### Deux pieges de l'API, traites

`git_commit_sha` d'une application vaut **`"HEAD"`** : c'est la consigne de suivi de branche, pas le commit deploye. Le vrai commit ne se lit que dans `GET /deployments/applications/{uuid}` — dont chaque entree embarque ses logs, soit ~500 Ko. D'ou la pagination `?take=5`. Et l'attente d'un deploiement sonde `GET /deployments` (quelques octets) plutot que `GET /deployments/{uuid}` (un demi-megaoctet par sondage).

La comparaison se fait contre **`origin/main`**, pas contre le HEAD local : Coolify batit la branche distante. L'ecart entre les deux est signale.

### Ajouter un vrai domaine a un site existant

L'ordre compte, et la premiere etape n'est pas automatisable :

```bash
# 1. chez le registrar du domaine, a la main :
#      CNAME www.monsite.fr → monsite.00.re
# 2. verifier et declarer :
npm run deploy:alias -- monSlug www.monsite.fr --write
# 3. Traefik ne regenere ses routes qu'au deploiement :
npm run deploy -- monSlug --yes
```

L'etape 2 **refuse** si le domaine ne resout pas encore vers le serveur : le declarer trop tot ferait echouer Let's Encrypt en HTTP-01 sur cet hote. Le sous-domaine d'amorce continue de servir pendant toute la bascule.

### Creer un site

```bash
# renseigner d'abord coolifyApp et domain dans sites.json —
# ils ne sont derivables ni du slug ni de la config, il faut les choisir
npm run deploy:dns    -- monSlug --write     # CNAME dans la zone 00.re
npm run deploy:create -- monSlug --write     # application + 8 variables
npm run deploy        -- monSlug --yes       # premier deploiement
```

`create` ne passe jamais `instant_deploy` : deployer avant d'avoir pose les variables produirait le theme par defaut et une config non figee. L'ordre DNS → application → variables → deploiement n'est pas negociable.

## Voir aussi

- [Configuration](02-configuration.md)
- [Performance](12-performance.md)
- [Tests](15-tests.md)
