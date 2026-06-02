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
    db/              # Relational Postgres/MySQL storage and DB utilities
    config/          # Shared lint/ts/build configs
    ui/              # Shared admin web UI primitives
  sdk/
    android/         # Native Android SDK
    ios/             # Native iOS SDK
    flutter/         # Flutter wrapper over the native SDKs
  docs/
    prd/             # Product requirement docs
    adr/             # Architectural decision records
```

## Module boundaries

- `apps/admin-web` can depend only on `packages/*`.
- `apps/api` can depend only on `packages/contracts`, `packages/db`, `packages/config`.
- `sdk/android` and `sdk/ios` are isolated from Node workspace packages and evolve with native toolchains.
- `sdk/flutter` stays thin and ships vendored native SDK snapshots behind platform-specific wrappers.
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

- Production runtime relational Postgres veya MySQL tablolarını kullanır.
- Runtime DB çözümleme sırası `env -> OPEN_STORY_DB_CONFIG_PATH içindeki config file` şeklindedir; local SQLite fallback yalnızca non-production/test kullanım içindir.
- Admin `Settings` ekranı Postgres ve MySQL bağlantı bilgilerini gösterir, bağlantı testi yapar ve config file tabanlı ayarları yönetir.
- Cloud Run + Cloud SQL MySQL kurulumu için `docs/cloud-run-cloud-sql-mysql.md` dokümanını kullanın.
- Eski tek tablo SQL modu ve migration scripti artık runtime yüzeyinin parçası değildir.

## Asset Storage

- Admin asset akışında URL, Server Upload ve Cloud Upload seçenekleri bulunur.
- Production için Cloud Upload önerilir; Google Cloud Storage bucket ve CDN public URL ayarı `Storage & CDN` ekranından yönetilir.
- Runtime storage çözümleme sırası `env -> OPEN_STORY_ASSET_STORAGE_CONFIG_PATH içindeki config file -> local disk fallback` şeklindedir.
- SDK feed sözleşmesi değişmez; mobil SDK'lar yine asset public URL alanını kullanır.
