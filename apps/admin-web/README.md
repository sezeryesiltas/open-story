# @open-story/admin-web

Open Story v1 admin console scaffold.

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui style primitive components
- TanStack Query
- React Hook Form + Zod

## Commands

```bash
pnpm --filter @open-story/admin-web dev
pnpm --filter @open-story/admin-web build
pnpm --filter @open-story/admin-web lint
pnpm --filter @open-story/admin-web check
```

## Current state

- Landing/dashboard skeleton created.
- Placements ekranı hero + card list + empty state + right sheet create/edit akışı ile çalışıyor.
- Query provider wiring ready for API integration.
- `Settings` ekranı aktif sqlite hedefini gösterir ve harici sqlite URL/path geçişini yapar.

## Runtime notes

- Admin API çağrıları için varsayılan adres `http://localhost:3000` kullanılır.
- Gerekirse `NEXT_PUBLIC_API_BASE_URL` ile farklı backend adresi verilebilir.
