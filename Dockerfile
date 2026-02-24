# ===== Étape 1 : build =====
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ===== Étape 2 : production ultra-légère =====
FROM node:22-alpine AS runner
WORKDIR /app

# Copier les builds
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server/prod-server.js ./server/prod-server.js
COPY --from=builder /app/server/middleware ./server/middleware

# Package.json minimal (juste pour ESM) + deps externalisées
RUN echo '{"type":"module"}' > package.json && \
    npm install express@5 compression serialize-javascript isomorphic-dompurify @communecter/cocolight-api-client sharp && \
    npm cache clean --force

# Volume pour le cache d'images optimisées (persiste entre les redémarrages)
VOLUME /app/.cache/images

EXPOSE 80
CMD ["node", "server/prod-server.js"]
