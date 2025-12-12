# ===== Étape 1 : build complet =====
FROM node:22-alpine AS builder
WORKDIR /app

# 1. Copie manifestes et installation (dev+prod)
COPY package.json package-lock.json ./
RUN npm install --frozen-lockfile

# 2. Copie code source et build
COPY . .
RUN npm run build

# 3. Préparation des modules de production seulement
RUN npm install --production --frozen-lockfile && \
    npm cache clean --force

# ===== Étape 2 : image finale =====
FROM node:22-alpine AS runner
WORKDIR /app

# 4. Copie uniquement l’essentiel
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server/prod-server.js ./server/prod-server.js
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 80
CMD ["node", "server/prod-server.js"]