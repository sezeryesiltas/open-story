# ---- Stage 1: Dependencies ----
FROM node:22-slim AS deps

RUN corepack enable pnpm

WORKDIR /app

# Copy dependency manifests first (cache layer)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/admin-web/package.json ./apps/admin-web/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/db/package.json ./packages/db/
COPY packages/ui/package.json ./packages/ui/
COPY packages/config/package.json ./packages/config/

RUN pnpm install --frozen-lockfile


# ---- Stage 2: Builder ----
FROM deps AS builder

# Copy all source files
COPY turbo.json ./
COPY apps/ ./apps/
COPY packages/ ./packages/

# Build API (tsc) and Admin Web (next build)
RUN pnpm run build


# ---- Stage 3: Runner ----
FROM node:22-slim AS runner

RUN corepack enable pnpm && npm install -g pm2

WORKDIR /app

# Copy the full built workspace
COPY --from=builder /app ./

# Remove dev dependencies to slim the image
RUN pnpm prune --prod

# Create data directory (will be overridden by volume mount)
RUN mkdir -p /data/assets

EXPOSE 3000 3001

CMD ["pm2-runtime", "ecosystem.config.cjs"]
