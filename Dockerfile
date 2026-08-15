# syntax=docker/dockerfile:1

# node:22-bookworm-slim pinned explicitly on both stages — the "slim" alias
# (without a Debian codename) drifts to whatever release is current (trixie)
# and would silently change the base image on a future rebuild.
FROM node:22-bookworm-slim AS build
WORKDIR /app

# python3/make/g++ are only the prebuild fallback for better-sqlite3 when no
# prebuilt binary matches this platform; not needed at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
# Migrations run on boot and are read from ./drizzle (see MIGRATIONS_FOLDER
# in src/server/db.ts), relative to the process working directory.
COPY --from=build /app/drizzle ./drizzle

# The node user (uid 1000) needs to create/write lapse.db under /data itself;
# without this the mkdirSync in src/server/db.ts fails EACCES on a fresh
# mount point owned by root. A host bind mount still needs its own
# ownership fixed on the host — see docs/deploy.md.
RUN mkdir -p /data && chown node:node /data

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

CMD ["node", "dist/server/index.js"]
