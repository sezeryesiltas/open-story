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

# Build only admin-web (API runs from TypeScript source via tsx at runtime)
RUN pnpm --filter @open-story/admin-web run build


# ---- Stage 3: Runner ----
FROM node:22-slim AS runner

RUN corepack enable pnpm && npm install -g pm2

WORKDIR /app

# Copy the full built workspace (keep devDependencies — tsx needed at runtime for API)
COPY --from=builder /app ./

# Create data directory (will be overridden by volume mount)
RUN mkdir -p /data/assets

EXPOSE 3000 3001

CMD ["pm2-runtime", "ecosystem.config.cjs"]
