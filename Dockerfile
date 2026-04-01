# ===== Étape 1 : build =====
FROM node:22-alpine AS builder
WORKDIR /app

# CSS du site à bundler (par ordre de priorité) :
#   1. --build-arg SITE_CSS_CONTENT="$(cat mon-theme.css)"  (contenu inline)
#   2. --build-arg SITE_CSS_PATH=./src/index-cyber-reunion.css  (chemin)
#   3. --build-arg VITE_SLUG=cyberReunion  (lookup dans sites.json)
#   4. Sans argument → src/index.css (thème par défaut)
ARG VITE_SLUG
ARG SITE_CSS_PATH
ARG SITE_CSS_CONTENT
ENV VITE_SLUG=${VITE_SLUG}
ENV SITE_CSS_PATH=${SITE_CSS_PATH}
ENV SITE_CSS_CONTENT=${SITE_CSS_CONTENT}

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ===== Étape 2 : production ultra-légère =====
FROM node:22-alpine AS runner
WORKDIR /app

# Config JSON du site (obligatoire : l'un des deux)
ENV SITE_CONFIG_PATH=""
ENV SITE_CONFIG_JSON=""
# URLs backend
ENV VITE_BASE_URL_BACKEND=""
ENV VITE_SERVER_URL=""
# Slug du site
ENV VITE_SLUG=""
# Domaines autorisés pour l'optimiseur d'images (séparés par des virgules)
ENV IMAGE_OPTIMIZER_ALLOWED_DOMAINS=""

# Copier les builds
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server/prod-server.js ./server/prod-server.js
COPY --from=builder /app/server/middleware ./server/middleware

# Package.json minimal (juste pour ESM) + deps externalisées
RUN echo '{"type":"module"}' > package.json && \
    npm install express@5 compression serialize-javascript isomorphic-dompurify @communecter/cocolight-api-client sharp multer react react-dom && \
    npm cache clean --force

# Volume pour le cache d'images optimisées (persiste entre les redémarrages)
VOLUME /app/.cache/images

EXPOSE 80
CMD ["node", "server/prod-server.js"]
