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
- `Settings` ekranı aktif relational Postgres hedefini gösterir ve Postgres bağlantı bilgisini yönetir.
- `Storage & CDN` ekranı local asset storage, Google Cloud Storage/CDN ve Supabase Storage S3 hedefini yönetir.
- Asset oluşturma akışında URL, Server Upload ve Cloud Upload seçenekleri bulunur; production için Cloud Upload önerilir.

## Runtime notes

- Browser tarafı her zaman local `app/api/*` BFF route’larına gider.
- BFF tarafı, auth dahil olmak üzere tüm admin isteklerini backend API'ye proxy eder.
- Same-container çalışmada backend varsayılanı `http://localhost:3001` adresidir.
- Split-container Docker çalışmada `OPEN_STORY_API_BASE_URL=http://api:3001` kullanın.
- Gerekirse backend adresi `OPEN_STORY_API_BASE_URL` ile override edilir.
