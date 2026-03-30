# ADR 0001: Monorepo and Module Boundaries

- Status: Accepted
- Date: 2026-03-30

## Context

We are building a narrow v1 Story Bar Platform with three independently evolving product surfaces:

1. backend API
2. admin console
3. two native SDKs (Android + iOS)

All must live in one repository, but with hard boundaries to avoid accidental coupling and scope creep.

## Decision

We use a modular monolith monorepo with `pnpm workspaces` + `turborepo` for JavaScript/TypeScript modules and separate native directories under `sdk/`.

Directory boundaries:

- `apps/admin-web`: admin product UI only.
- `apps/api`: delivery and admin backend modules only.
- `packages/contracts`: canonical shared contracts.
- `packages/db`: DB schema + persistence module.
- `packages/config`: shared tooling config.
- `packages/ui`: reusable admin UI components only.
- `sdk/android`: native Android SDK, Kotlin toolchain.
- `sdk/ios`: native iOS SDK, Swift toolchain.

## Consequences

- Faster local iteration while retaining hard conceptual boundaries.
- Shared contracts are centralized to reduce drift between admin/api/sdk.
- Native SDK implementation remains isolated from Node runtime concerns.
- We can add CI policy checks per folder to keep boundaries strict.
