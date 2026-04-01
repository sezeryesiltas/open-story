# open-story

Story Bar Platform monorepo (v1 scope only).

## Branching

Initial monorepo foundation is created on branch:

- `feat/monorepo-foundation`

## Monorepo layout

```text
/
  apps/
    admin-web/       # Next.js + shadcn/ui admin console
    api/             # NestJS + Fastify delivery API
  packages/
    contracts/       # Shared API/domain contracts
    db/              # SQLite-backed storage and DB utilities
    config/          # Shared lint/ts/build configs
    ui/              # Shared admin web UI primitives
  sdk/
    android/         # Native Android SDK
    ios/             # Native iOS SDK
  docs/
    prd/             # Product requirement docs
    adr/             # Architectural decision records
```

## Module boundaries

- `apps/admin-web` can depend only on `packages/*`.
- `apps/api` can depend only on `packages/contracts`, `packages/db`, `packages/config`.
- `sdk/android` and `sdk/ios` are isolated from Node workspace packages and evolve with native toolchains.
- Shared domain contracts must live in `packages/contracts` before being duplicated anywhere else.

See `docs/adr/0001-monorepo-module-boundaries.md` for rationale and enforcement principles.

## Current state

This commit establishes folder structure + workspace orchestration.
Feature implementation starts next in this order:

1. shared contracts + DB schema
2. admin auth + user management
3. placement/client/token management
4. revision model and feed resolution API
5. native SDK implementation

## Database

- Varsayılan storage `apps/api/data/open-story.sqlite` dosyasıdır.
- Aktif DB hedefi local bootstrap config ile saklanır.
- Admin `Settings` ekranı üzerinden harici sqlite URL/path tanımlanabilir.
