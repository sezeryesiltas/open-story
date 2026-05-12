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
- The Placements screen works with a hero, card list, empty state, and right-sheet create/edit flow.
- Query provider wiring ready for API integration.
- The `Settings` screen shows the active relational Postgres target and manages Postgres connection details.
- The `Storage & CDN` screen manages local asset storage, Google Cloud Storage/CDN, and Supabase Storage S3 targets.
- The asset creation flow includes URL and upload options; Server Upload/from-computer options are hidden when an external Storage/CDN provider is active.

## Runtime notes

- The browser side always calls local `app/api/*` BFF routes.
- The BFF side proxies all admin requests, including auth, to the backend API.
- In same-container runs, the default backend address is `http://localhost:3001`.
- In split-container Docker runs, use `OPEN_STORY_API_BASE_URL=http://api:3001`.
- The backend address can be overridden with `OPEN_STORY_API_BASE_URL` when needed.
- The `Settings` and `Storage & CDN` screens show the effective runtime setting; Postgres is required for production DB usage, and local fallback is only for non-production/test use.
