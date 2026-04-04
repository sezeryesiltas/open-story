# Admin Release Readiness Review

Date: 2026-04-05

## Scope

Bu dokuman, `apps/admin-web` ve onu besleyen monorepo/API katmaninin production readiness durumunu degerlendirmek ve SDK calismalarina gecmeden once release acisindan kalan kritik isleri netlestirmek icin hazirlandi.

## Executive Summary

- `@open-story/admin-web` tek basina production build aliyor.
- Workspace genelinde `pnpm check` ve `pnpm test` yesil.
- Buna ragmen kok `pnpm build` kirik oldugu icin platformu production-ready saymak dogru degil.
- SDK implementasyonuna gecmek teknik olarak mumkun, ancak release oncesi bu dokumandaki blocker'lar kapanmali.

## Validation Snapshot

Calistirilan temel komutlar:

- `pnpm check` -> gecti
- `pnpm test` -> gecti
- `pnpm --filter @open-story/admin-web build` -> gecti
- `pnpm build` -> kaldi
- `pnpm lint` -> gecti, ancak bazi paketlerde gercek lint yerine placeholder script var

## Findings

### 1. Critical: Workspace production build kirik

Kokten `pnpm build` calismiyor. En buyuk nedenler:

- `apps/api` `NodeNext` altinda `.ts` extension ile import kullaniyor.
- API build zincirinde `@types/node` eksik.
- `fastify` tipi import ediliyor, fakat dependency listesinde yok.
- `packages/contracts` ve `packages/db` de `.ts` suffix export/import pattern'i ile API build'ini kiriyor.

Bu durum release blocker'dir. Deploy edilebilir artifact zinciri guvenilir degil.

Referanslar:

- `apps/api/tsconfig.json`
- `apps/api/package.json`
- `apps/api/src/app.module.ts`
- `apps/api/src/common/filters/global-exception.filter.ts`
- `packages/contracts/src/index.ts`
- `packages/db/src/index.ts`

### 2. Critical: Insecure default auth fallback'lari var

Environment verilmezse sistem su varsayimlarla ayaga kalkiyor:

- seed admin password: `admin123`
- admin JWT secret: `open-story-local-admin-jwt-secret`

Bu degerler local gelistirme icin tolere edilebilir, fakat production icin release blocker'dir. Yanlis config ile sistem sessizce insecure acilabiliyor.

Referanslar:

- `apps/api/src/story-platform/story-platform.repository.ts`
- `apps/api/src/admin-auth/simple-jwt.ts`

### 3. High: Admin auth akisi backend'i HTTP uzerinden degil, dogrudan source import ile kullaniyor

`admin-web` tarafindaki auth runtime su dosyalari dogrudan import ediyor:

- `apps/api/src/admin-auth/*`
- `apps/api/src/modules/auth/*`
- `apps/api/src/story-platform/*`

Sonuc:

- auth route'lari gercek deploy edilmis API contract'ini dolayliyor
- diger admin route'lari HTTP ile backend'e giderken auth yolu ayri bir execution path kullaniyor
- monorepo modul boundary bozuluyor
- auth'in calisiyor olmasi, gercek production API entegrasyonunun saglam oldugunu kanitlamiyor

Bu bir release hygiene ve architecture riskidir.

Referanslar:

- `README.md`
- `apps/admin-web/lib/server/auth-runtime.ts`
- `apps/admin-web/app/api/auth/login/route.ts`
- `apps/admin-web/app/api/auth/me/route.ts`
- `apps/admin-web/app/api/placements/route.ts`
- `apps/admin-web/lib/server/backend-api.ts`

### 4. Medium: Quality gates gercekte eksik

Workspace seviyesinde yesil gorunen bazi scriptler placeholder:

- `packages/config`
- `packages/ui`
- `packages/contracts`
- `packages/db`
- `apps/api` lint

Yani pipeline yesil olsa bile her paket gercek build/lint/test denetiminden gecmiyor.

Ek olarak admin tarafindaki testler AGENTS'te beklenen kapsamdan daha dar:

- auth flows
- user create/reset flows
- placement CRUD
- set/group/story CRUD
- publish/unpublish/archive flows
- preview smoke test

Mevcut `apps/admin-web` testleri daha cok `lib/server/*.test.mjs` seviyesinde utility coverage sagliyor.

Referanslar:

- `AGENTS.md`
- `apps/admin-web/package.json`
- `packages/config/package.json`
- `packages/ui/package.json`
- `packages/contracts/package.json`
- `packages/db/package.json`
- `apps/admin-web/lib/server/placement-metrics.test.mjs`
- `apps/admin-web/lib/server/preview-store.test.mjs`
- `apps/admin-web/lib/server/story-group-lifecycle.test.mjs`
- `apps/admin-web/lib/server/story-lifecycle.test.mjs`

## Important Notes

### Admin web tarafi tamamen kirik degil

Bu inceleme, admin UI'in kullanilamaz oldugu anlamina gelmiyor. Aksine:

- admin web production build aliyor
- preview, placements, stories, sets, groups, users ve settings yuzeyleri mevcut
- API/domain tarafinda anlamli test coverage bulunuyor

Sorun daha cok platform release zincirinin tamamlanmamis olmasi.

### SDK calismalarina gecis mumkun, ama release onayi icin erken

Bugunku durumda en mantikli karar:

- SDK implementasyonuna baslanabilir
- admin/backend "production-ready" olarak etiketlenmemeli
- release oncesi en azindan build ve security blocker'lari kapatilmalı

### Tech direction notu

AGENTS dokumaninda backend stack icin `Fastify`, `Prisma`, `PostgreSQL`, `S3-compatible object storage` oneriliyor.
Mevcut implementation ise agirlikli olarak:

- sqlite/file storage
- local asset serving
- Nest app icinde farkli runtime varsayimlari

Bu tek basina bug degil; ancak release oncesi "hedef architecture ne?" konusu netlestirilmeli.

Referanslar:

- `AGENTS.md`
- `apps/api/README.md`
- `packages/db/src/db.service.ts`
- `apps/api/src/main.ts`

## Release Decision

Su anki karar:

- `admin-web`: fonksiyonel olarak ilerlemis durumda
- platform genel durumu: production-ready degil
- SDK work: baslanabilir
- release: blocker task'lar kapanmadan verilmemeli

## Suggested Pre-Release Task Buckets

Bu basliklar task olusturmak icin baslangic noktasi olarak kullanilabilir:

1. API build zincirini duzelt
2. package export/import modelini production build ile uyumlu hale getir
3. auth secret ve seed password fallback'larini production-safe yap
4. admin auth BFF akisini gercek backend API contract'ina tasi
5. placeholder lint/build/test scriptlerini gercek kontrollerle degistir
6. admin readiness icin AGENTS'teki minimum test kapsamini tamamla
7. release ve runtime env dokumantasyonunu guncelle

## Review Notes

- Inceleme dirty worktree uzerinde degil, repo temizdi.
- Bu dokuman release planning icindir; kesin product direction degisikligi onermiyor.
- Buradaki blocker'lar kapandiginda ikinci bir short readiness pass yapmak mantikli olur.
