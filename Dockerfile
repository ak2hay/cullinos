# syntax=docker/dockerfile:1
#
# Layer order is the speedup: package manifests and `npm ci` stay cached when
# only TypeScript changes. BuildKit cache mounts keep the npm tarball cache
# across lockfile bumps. GIT_COMMIT is declared in the runner stage so a new
# SHA does not rebuild dependencies.

FROM node:22-alpine AS deps

WORKDIR /app

# Prisma's query engine needs OpenSSL on Alpine.
RUN apk add --no-cache openssl

COPY package.json package-lock.json .npmrc ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/app-ops/package.json apps/app-ops/package.json
COPY apps/guest-web/package.json apps/guest-web/package.json
COPY apps/kds/package.json apps/kds/package.json
COPY apps/kds-desktop/package.json apps/kds-desktop/package.json
COPY apps/kiosk/package.json apps/kiosk/package.json
COPY apps/management/package.json apps/management/package.json
COPY apps/pos/package.json apps/pos/package.json
COPY apps/pos-desktop/package.json apps/pos-desktop/package.json
COPY apps/super-admin/package.json apps/super-admin/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/ai-contracts/package.json packages/ai-contracts/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/events/package.json packages/events/package.json
COPY packages/integrations/package.json packages/integrations/package.json
COPY packages/menu-catalog/package.json packages/menu-catalog/package.json
COPY packages/prisma/package.json packages/prisma/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/sync/package.json packages/sync/package.json
COPY packages/tax-engine/package.json packages/tax-engine/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN --mount=type=cache,target=/root/.npm \
    npm ci --include=dev --no-audit --no-fund

FROM deps AS builder

COPY tsconfig.base.json ./
COPY index.js ./
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
COPY packages/auth ./packages/auth
COPY packages/events ./packages/events
COPY packages/integrations ./packages/integrations
COPY packages/menu-catalog ./packages/menu-catalog
COPY packages/prisma ./packages/prisma
COPY packages/sync ./packages/sync
COPY packages/tax-engine ./packages/tax-engine
COPY packages/ai-contracts ./packages/ai-contracts

RUN npm run build:api \
    && npm prune --omit=dev

FROM node:22-alpine AS runner

# Baked build SHA served by GET /api/v1/health (commit). CI passes the short
# git SHA; Compose passes GIT_COMMIT from the deploy script.
ARG GIT_COMMIT=unknown

WORKDIR /app

ENV NODE_ENV=production \
    GIT_COMMIT=${GIT_COMMIT}

LABEL org.opencontainers.image.title="cullinos-api" \
      org.opencontainers.image.source="https://github.com/ak2hay/cullinos" \
      org.opencontainers.image.revision="${GIT_COMMIT}"

RUN apk add --no-cache openssl \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 cullinos

COPY --from=builder --chown=cullinos:nodejs /app ./

USER cullinos

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/v1/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "index.js"]
