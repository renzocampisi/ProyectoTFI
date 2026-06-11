# Dockerfile del backend FieldStock AI para deploy en Fly.io.
#
# Build en 2 stages para que la imagen final no incluya devDeps (nodemon,
# jest, babel) — pesa menos y arranca más rápido en cold start.
#
# Base: node:22-alpine (~50MB) — mucho más chico que node:20 (~300MB)
# y suficiente para nuestro stack (Express + Supabase SDK, sin deps nativas).

# ───────── Stage 1: install deps de producción ─────────
FROM node:22-alpine AS deps
WORKDIR /app

# Copiamos solo los manifests primero para aprovechar el cache de capas
# de Docker: si package.json no cambió, npm ci no se vuelve a ejecutar.
COPY package.json package-lock.json* ./

# `npm ci` es más estricto que `npm install` (falla si lockfile difiere).
# `--omit=dev` excluye devDependencies (nodemon, jest) que no necesitamos
# para correr en prod.
RUN npm ci --omit=dev --no-audit --no-fund

# ───────── Stage 2: imagen final runtime ─────────
FROM node:22-alpine AS runtime
WORKDIR /app

# Variables de entorno por default. PORT lo override Fly.io con su env.
ENV NODE_ENV=production \
    PORT=8080

# Copiamos node_modules ya instalados del stage anterior + el código fuente.
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Documentación del puerto (Fly.io ignora EXPOSE pero ayuda a quien lea
# el Dockerfile a entender qué puerto bindea la app).
EXPOSE 8080

# El backend bindea a 0.0.0.0 (ver src/index.js) — necesario para que
# Fly.io pueda enrutar tráfico al container.
CMD ["node", "src/index.js"]
