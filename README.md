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
    db/              # Relational Postgres storage and DB utilities
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

- Production runtime relational Postgres tablolarını kullanır.
- Aktif Postgres hedefi runtime env değişkenlerinden veya `OPEN_STORY_DB_CONFIG_PATH` altındaki bootstrap config dosyasından okunur.
- Admin `Settings` ekranı sadece Postgres bağlantı bilgilerini yönetir.
- Eski tek tablo Postgres modu ve migration scripti artık runtime yüzeyinin parçası değildir.

## Asset Storage

- Admin asset akışında URL, Server Upload ve Cloud Upload seçenekleri bulunur.
- Production için Cloud Upload önerilir; Google Cloud Storage bucket ve CDN public URL ayarı `Storage & CDN` ekranından yönetilir.
- SDK feed sözleşmesi değişmez; mobil SDK'lar yine asset public URL alanını kullanır.
