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

# Build admin-web for production. API still runs from source via tsx.
RUN pnpm --filter @open-story/admin-web run build


# ---- Stage 3a: API Runner ----
FROM node:22-slim AS api-runner

RUN corepack enable pnpm && npm install -g tsx

WORKDIR /app

COPY --from=builder /app ./

RUN mkdir -p /data/db /data/assets

EXPOSE 3001

CMD ["tsx", "--tsconfig", "apps/api/tsconfig.json", "apps/api/src/main.ts"]


# ---- Stage 3b: Admin Web Runner ----
FROM node:22-slim AS admin-web-runner

WORKDIR /app

COPY --from=builder /app ./

WORKDIR /app/apps/admin-web

EXPOSE 3000

CMD ["./node_modules/.bin/next", "start", "-p", "3000"]
