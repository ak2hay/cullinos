# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder

WORKDIR /app

# Prisma requires OpenSSL on Alpine
RUN apk add --no-cache openssl

COPY package.json package-lock.json .npmrc ./
COPY apps ./apps
COPY packages ./packages
COPY index.js turbo.json tsconfig.base.json ./

RUN npm ci --include=dev \
  && npm run build:api \
  && npm prune --omit=dev

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 cullinos

COPY --from=builder --chown=cullinos:nodejs /app ./

USER cullinos

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/v1/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "index.js"]
