# BUROFAST · imagen de producción (Next.js standalone). Construir desde la raíz:
#   docker build -f infrastructure/docker/Dockerfile -t burofast:0.1.0 .
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Las migraciones NO corren en el build de la imagen: corren al arrancar el
# contenedor, cuando la base de datos de la red privada ya es alcanzable.
RUN npx next build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S burofast && adduser -S burofast -G burofast
COPY --from=build --chown=burofast:burofast /app/.next/standalone ./
COPY --from=build --chown=burofast:burofast /app/.next/static ./.next/static
COPY --from=build --chown=burofast:burofast /app/public ./public
COPY --from=build --chown=burofast:burofast /app/db ./db
COPY --from=build --chown=burofast:burofast /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=deps --chown=burofast:burofast /app/node_modules/postgres ./node_modules/postgres
USER burofast
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:3000/health/live >/dev/null || exit 1
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
