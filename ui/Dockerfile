# syntax=docker/dockerfile:1

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime ----
# The SSR server bundle (server.mjs) includes its dependencies, so node_modules is not needed.
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=4000 \
    API_INTERNAL_URL=http://api:5000 \
    SSR_CACHE_TTL=60
WORKDIR /app
COPY --from=build --chown=node:node /app/dist/build ./dist/build
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1
CMD ["node", "dist/build/server/server.mjs"]
