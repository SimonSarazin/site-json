# ===== Étape 1 : build =====
FROM node:22-alpine AS builder
WORKDIR /app

# ---- Ce que le build embarque -----------------------------------------------
#
# CSS (par ordre de priorité) :
#   1. --build-arg SITE_CSS_CONTENT="$(cat mon-theme.css)"  (contenu inline)
#   2. --build-arg SITE_CSS_PATH=./src/index-cyber-reunion.css  (chemin)
#   3. --build-arg VITE_SLUG=cyberReunion  (lookup dans sites.json)
#   4. Sans argument → src/index.css (thème par défaut)
#
# Images : --build-arg SITE_IMAGES=institutBleu n'embarque que ce dossier de
#   public/images/ (nom de DOSSIER, pas un chemin ; plusieurs séparés par des
#   virgules). Le nom se lit dans le champ `images` de sites.json — il ne suit
#   pas le slug. Sans l'argument, les 13 dossiers sont embarqués comme avant.
#
# Config : --build-arg SITE_EMBED=true fige SITE_CONFIG_JSON puis
#   SITE_CONFIG_PATH dans dist/site-config.json, que prod-server lit au niveau 3.
#   Le conteneur n'a alors plus besoin ni de volume ni de SITE_CONFIG_PATH.
#   Le drapeau est nécessaire parce que ces deux variables ont déjà un sens à
#   l'exécution : sans lui, rien n'est figé et le comportement est inchangé.
#
# Les ARG ci-dessous sont OBLIGATOIRES : Docker ignore silencieusement un
# --build-arg qu'aucun ARG ne déclare, donc sans eux une variable cochée
# « Build Variable » dans Coolify n'atteindrait jamais le build.
ARG VITE_SLUG
ARG SITE_CSS_PATH
ARG SITE_CSS_CONTENT
ARG SITE_IMAGES
ARG SITE_EMBED
ARG SITE_CONFIG_PATH
ARG SITE_CONFIG_JSON
ENV VITE_SLUG=${VITE_SLUG}
ENV SITE_CSS_PATH=${SITE_CSS_PATH}
ENV SITE_CSS_CONTENT=${SITE_CSS_CONTENT}
ENV SITE_IMAGES=${SITE_IMAGES}
ENV SITE_EMBED=${SITE_EMBED}
ENV SITE_CONFIG_PATH=${SITE_CONFIG_PATH}
ENV SITE_CONFIG_JSON=${SITE_CONFIG_JSON}

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ===== Étape 2 : production ultra-légère =====
FROM node:22-alpine AS runner
WORKDIR /app

# Config JSON du site. Obligatoire SAUF si l'image a été construite avec
# SITE_EMBED=true, auquel cas dist/site-config.json prend le relais (niveau 3).
# Les valeurs vides remises ici sont volontaires : elles neutralisent les ENV de
# l'étape builder, qui ne doivent pas fuiter dans le runtime.
ENV SITE_CONFIG_PATH=""
ENV SITE_CONFIG_JSON=""
# URLs backend
ENV VITE_BASE_URL_BACKEND=""
ENV VITE_SERVER_URL=""
# Slug du site
ENV VITE_SLUG=""
# Domaines autorisés pour l'optimiseur d'images (séparés par des virgules)
ENV IMAGE_OPTIMIZER_ALLOWED_DOMAINS=""
# Temps reel (docs/29). Vide = fonctionnalite absente, le client reste en polling.
#  HUB    : le hub SSE, toujours Node. Ne detient aucune cle de signature.
#  TICKET : l'emetteur du ticket — legacy PHP OU backend Node, celui que la lib interroge.
#           Defaut : <HUB>/realtime/ticket, correct quand la cible de la lib EST le hub.
ENV REALTIME_HUB_URL=""
ENV REALTIME_TICKET_URL=""

# Copier les builds
COPY --from=builder /app/dist ./dist
# server/ entier (prod-server + middleware + utils + api). Copie complète plutôt
# que fichier par fichier pour éviter les oublis (dev-server.js est inclus mais
# jamais exécuté en prod — CMD lance prod-server.js).
COPY --from=builder /app/server ./server

# Package.json minimal (juste pour ESM) + deps externalisées
RUN echo '{"type":"module"}' > package.json && \
    npm install express@5 compression serialize-javascript isomorphic-dompurify @communecter/cocolight-api-client sharp multer dotenv react react-dom && \
    npm cache clean --force

# React et react-dom sont `external` du bundle SSR (vite.config.ts) et réinstallés
# juste au-dessus : leur point d'entrée npm choisit sa variante AU CHARGEMENT,
# `process.env.NODE_ENV === "production" ? react.production.js : react.development.js`.
# Sans cette ligne c'est la variante DEV qui se charge à chaque démarrage (46 Ko au
# lieu de 17 pour react, 419 au lieu de 271 pour react-dom/server), avec sa
# machinerie de validation rejouée à chaque rendu SSR — et Express se croit en
# `development` (traces verbeuses, pas de cache de vues).
# Aucune autre voie ne la pose : ni node:22-alpine, ni Coolify (elle n'est pas dans
# ses variables prédéfinies — c'est nixpacks qui la pose, build pack non utilisé ici).
# Placée APRÈS le `npm install` ci-dessus, pour ne pas modifier sa résolution de
# dépendances.
ENV NODE_ENV=production

# Volume pour le cache d'images optimisées (persiste entre les redémarrages)
VOLUME /app/.cache/images

EXPOSE 80
CMD ["node", "server/prod-server.js"]
