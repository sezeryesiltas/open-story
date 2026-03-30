# AGENTS.md

## Mission

Build a **narrow, reliable Story Bar Platform**.

This project is **not** a Storyly clone and **not** a generic placement engine.
Do not expand scope unless the user explicitly changes the product direction.

The v1 product is only:
- single-tenant admin console
- placement-managed story delivery
- one client with static-token auth
- native Android SDK
- native iOS SDK
- fixed story bar UI
- fixed fullscreen viewer UI
- image + video stories
- CTA callback to host app
- local viewed-state persistence

---

## Hard scope boundaries

### In scope
- Admin console built with **shadcn/ui**
- Placement entity management
- Single Client management with `client_id`
- Multiple active static tokens with revoke support
- `StoryGroupSet` draft/publish lifecycle
- `StoryGroup` draft/publish/archive lifecycle
- `Story` draft/publish/archive lifecycle
- Upload-first asset pipeline
- Feed resolution API
- Android SDK
- iOS SDK
- Metadata cache + media cache
- Local-only viewed state
- Optional analytics callbacks
- Basic preview in admin

### Explicitly out of scope for v1
- Generic placement surface
- Banner, swipe card, quiz, poll, form, shoppable content
- Web SDK
- React Native SDK
- Theming engine / host-controlled styling
- Multi-language content
- Approval workflows / multi-role publishing
- Scheduling / timed publishing
- Admin analytics dashboard
- Server-synced viewed state
- Video transcoding
- Signed asset URLs
- Any hidden A/B testing system

If you feel tempted to add any of these, stop.

---

## Product invariants

These rules are not optional.

1. The system is **single-tenant**.
2. There is **one Client**.
3. A Client may have **multiple active static tokens**.
4. `placement_key` is supplied at render time, not SDK init time.
5. Targeting happens at **StoryGroupSet level only**.
6. `StoryGroup` may be reused across multiple sets by shared reference.
7. `Story` belongs to exactly **one** group at a time.
8. CTA supports both `url` and `deeplink`.
9. SDK never performs navigation; it only emits callbacks.
10. Viewed state is **local device only**.
11. Viewed state is **revision-aware**.
12. UI is **fixed**. Do not build theme overrides in v1.
13. Public asset URLs are allowed in v1.
14. On `401/403`, SDK must not render cached content.

---

## Architecture choice

Use a **modular monolith** in a monorepo.
Do not start with microservices.

### Recommended repo layout

```text
/
  apps/
    admin-web/
    api/
  packages/
    contracts/
    db/
    config/
    ui/
  sdk/
    android/
    ios/
  docs/
    adr/
    prd/
```

Do not create random top-level folders.

---

## Recommended stack

### Monorepo
- `pnpm workspaces`
- `Turborepo`

### Admin web
- `Next.js`
- `TypeScript`
- `shadcn/ui`
- `Tailwind CSS`
- `TanStack Query`
- `React Hook Form`
- `Zod`

### Backend API
- `NestJS`
- `Fastify`
- `Prisma`
- `PostgreSQL`
- `S3-compatible object storage`

### Android SDK
- `Kotlin`
- `Android View` based fixed UI
- `Room`
- `OkHttp`
- `kotlinx.serialization`
- `Coil`
- `Media3 / ExoPlayer`

### iOS SDK
- `Swift`
- `UIKit` based fixed UI
- `URLSession`
- `Codable`
- `GRDB` or a minimal SQLite wrapper
- `AVFoundation / AVKit`

Keep SDK dependencies minimal and battle-tested.

---

## Core domain model

Use these names exactly.

- `Client`
- `StaticToken`
- `Placement`
- `StoryGroupSet`
- `StoryGroup`
- `Story`
- `Asset`
- `AdminUser`

### Relationships

- One `Client` exists in the system
- A `Client` has many `StaticToken`s
- A `Placement` has many `StoryGroupSet`s
- A `StoryGroupSet` contains many `StoryGroup`s
- A `StoryGroup` may belong to many `StoryGroupSet`s
- A `StoryGroup` contains many `Story`s
- A `Story` belongs to one `StoryGroup`

### Important modeling rule

Model `StoryGroupSet`, `StoryGroup`, and `Story` as:
- stable root entity
- draft revision
- optional published revision

Do not mutate live content directly.
Use a **working draft + published version** model.

Suggested pattern:
- root table
- revision table
- root keeps `current_draft_revision_id`
- root keeps `current_published_revision_id`

---

## Lifecycle and publish rules

### Story content changes
These go live when the **Story** is published:
- media change
- poster change
- CTA change
- image duration override change

If the parent group is already published, the new story revision becomes live immediately.

### Group composition changes
These require **StoryGroup republish**:
- add story
- remove story
- move story in/out
- reorder stories

### Set composition/config changes
These require **StoryGroupSet republish**:
- add/remove group
- reorder groups
- change placement
- change targeting
- change fallback flag

### Shared group rule
If a `StoryGroup` is used in multiple published sets, publishing that group makes the new published group revision visible in all of them immediately.

---

## Deletion and archive rules

### StoryGroupSet
- hard delete is allowed
- only delete when unpublished

### StoryGroup
- no hard delete in v1
- only archive / restore

### Story
- archive / restore supported
- hard delete only when safe
- never delete published or actively referenced content in a way that breaks live feed integrity

### Protection rule
If an entity is still actively referenced by another structure, do not allow destructive delete.
Prefer archive or unlink first.

---

## Feed visibility rules

A story is visible in the SDK feed only if all of these are true:

1. Client is active
2. Token is valid and active
3. A published set is resolved for the placement/context
4. The group is part of that set
5. The group is published
6. The group is not archived
7. The story is part of the published group composition
8. The story is published
9. The story is not archived

### Filtering rule
Use runtime child filtering.
A published parent may contain unpublished children.
Those children must simply be filtered out.

### Empty results rule
- Empty groups are removed from the feed
- If a set becomes empty after filtering, try the placement fallback set
- If fallback also yields nothing, return `200 + empty feed`

Do not invent hidden visibility rules outside this list.

---

## Targeting model

Targeting exists at `StoryGroupSet` level only.

### Inputs used for resolution
- `placement_key`
- `platform`
- `app_version`
- `user_segments[]`

### Platform
A set may target one or more platforms.
Each targeted platform has its own `min_app_version`.

Example:
- iOS min version `5.2.0`
- Android min version `8.1.0`

### Segments
- Request may contain multiple segments
- Set may contain multiple segments
- Set matching uses OR logic
- If request has no segments, only segmentless sets may match

### Fallback set
- At most one published fallback set per placement
- Fallback set has no targeting rules
- Used only when no normal set matches

### Resolution priority
When multiple sets match, use this order:

1. narrower platform target wins
2. highest compatible `min_app_version` wins
3. segment-specific match beats segmentless/default
4. if still needed, narrower segment list wins

### Ambiguity rule
Do not rely on runtime tie-breaking as a normal operating mode.
Publish validation must block ambiguous overlaps.
That includes:
- identical targeting rules
- overlapping segment rules that could match the same request
- ambiguous platform/version combinations

### App version comparison
Use dotted numeric comparison only.
- `major.minor.patch`
- missing parts are `0`
- no prerelease/build metadata support in v1

---

## Public SDK API contract

Prefer this endpoint for v1:

`POST /v1/sdk/feed`

### Request body

```json
{
  "client_id": "public-client-id",
  "placement_key": "home_top_story_bar",
  "platform": "ios",
  "app_version": "5.2.1",
  "user_segments": ["vip", "beta"]
}
```

### Auth

```http
Authorization: Bearer <static-token>
```

### Response style
Return a **full snapshot** of the resolved feed tree.
Do not build delta sync in v1.

The response should contain enough information for the SDK to:
- render the story bar
- open the viewer
- cache metadata
- compare revisions
- emit CTA and analytics callbacks

---

## SDK contract rules

### Initialization
Keep initialization simple.
Conceptual public API:
- `initialize(clientId, staticToken)`
- `setUserContext(userSegments)`
- `renderStoryBar(placementKey, container, callbacks)`
- `reload(placementKey)`

Use platform-native naming conventions, but preserve this conceptual shape.

### Context ownership
- SDK auto-sends `platform`
- SDK auto-sends `app_version`
- Host app provides `user_segments`
- Context changes do not auto-reload feed
- Host app must trigger reload explicitly

---

## SDK caching rules

### Feed cache
Store feed snapshots by:
- `placement_key`
- `platform`
- `app_version`
- normalized `user_segments` hash

This cache is context-scoped.

### Viewed state store
Viewed state is **global by content revision**, not by placement.
If the same story revision appears in another placement, it should already be considered viewed.

### Render strategy
- if cache exists, render immediately
- then refresh in background
- if refresh succeeds, update cache and UI
- if network/5xx fails, continue using cache
- cache may be used forever until a newer successful refresh exists
- if the refresh result is `401/403`, do not render cache

### Media cache
Cache both metadata and actual media files.
That includes:
- images
- videos
- video posters

Prefer immutable/versioned asset URLs so cache invalidation stays simple.

---

## Viewer behavior rules

### Opening behavior
When a group opens:
- start from first unviewed story
- if all are viewed, start from first story

### Story progression
- image default duration: `5s`
- image may override duration per story
- video duration equals natural video duration
- videos autoplay muted
- user may unmute

### Story navigation
- story-to-story navigation uses left/right tap zones
- same-group transition is fast show/hide
- no fancy animation inside a group

### Group navigation
- user may swipe to previous/next group
- boundary taps also navigate across groups
  - first story + left tap => previous group
  - last story + right tap => next group
- group-to-group transition uses a **cube effect**

### Neighbor group entry rule
- moving forward opens the target group at first unviewed story, otherwise first story
- moving backward opens the target group at last story

### Closing behavior
- close button supported
- swipe-down supported
- CTA tap closes viewer and then emits callback
- after the last group finishes, viewer closes automatically

### Pause / resume
- app background => pause
- app foreground => resume
- long press => temporary pause
- release => resume

---

## Viewed state rules

These rules are strict.

1. Mark a story viewed as soon as it starts displaying.
2. Mark a group viewed when all child story revisions are viewed.
3. New published revisions must reset viewed state for that content.
4. Group republish must recompute group viewed state from current child story revisions.
5. Preserve story viewed state at story-revision granularity.

Do not implement user-level backend sync in v1.

---

## CTA rules

CTA is optional.
If CTA exists, require:
- label
- target type (`url` or `deeplink`)
- target value

SDK must not navigate.
SDK must emit a callback payload to the host app.

The callback payload should include at least:
- placement key
- group id + group revision id
- story id + story revision id
- CTA label
- CTA type
- CTA value

---

## Analytics rules

### SDK callbacks
Expose optional callbacks for:
- `story_bar_impression`
- `story_group_tap`
- `story_view`
- `story_complete`
- `story_cta_tap`
- `viewer_close`
- `group_complete`

### Backend analytics
- Admin analytics dashboard is out of scope in v1
- Optional event ingestion may exist behind a feature flag
- Primary analytics path in v1 is host-side forwarding from SDK callbacks

Do not build a reporting UI in v1.

---

## Media rules

### Group logo
- required
- must be square

### Badge
- optional
- if present, only `emoji` or `svg`

### Story image
- allowed: `jpg`, `png`, `webp`
- required ratio: `9:16`

### Story video
- allowed: `mp4`
- codec: `H.264 + AAC`
- required ratio: `9:16`
- max duration: `30s`
- max size: `50MB`
- poster image is required

### Pipeline
No transcoding in v1.
Validate, extract metadata, store, and serve.

---

## Admin auth and user management rules

- email + password auth
- seed admin exists first
- later users are created by an admin
- new users receive a temporary password
- first login must force password change
- password reset is performed by another admin
- single role only in v1

Do not build self-service email reset in v1.

---

## Basic preview rule

Admin preview exists, but it is intentionally simple.
It should:
- use the same feed contract
- show order and content visibility correctly
- show CTA presence correctly
- approximate viewer behavior enough for editorial validation

It does not need to be pixel-perfect with native SDK transitions.

---

## Testing rules

### Minimum backend tests
- targeting resolution
- publish validation
- fallback resolution
- child filtering
- revision publish behavior
- token auth / revoke logic

### Minimum SDK tests
- cache-first render path
- background refresh update path
- 401/403 no-cache rendering rule
- viewed state transitions
- story navigation
- group navigation
- CTA callback payload mapping
- video/image duration behavior

### Minimum admin tests
- auth flows
- user create/reset flows
- placement CRUD
- set/group/story CRUD
- publish/unpublish/archive flows
- preview smoke test

---

## Delivery order for Codex

Build in this order:

1. monorepo scaffold
2. shared contracts and db schema
3. admin auth + admin user flows
4. placement + client + static token management
5. asset upload
6. revision model for set/group/story
7. publish validation and resolution engine
8. feed API
9. Android SDK cache + bar + viewer
10. iOS SDK cache + bar + viewer
11. basic preview
12. optional event ingestion flag

Do not start with polish or animation before contracts and state rules are stable.

---

## Definition of done

A feature is done only when:
1. it stays within scope,
2. contracts are updated,
3. critical tests exist,
4. lifecycle rules are respected,
5. error behavior is explicit,
6. SDK and backend semantics match,
7. docs are updated.

---

## Final reminder

This project wins by being:
- narrow,
- deterministic,
- fast,
- maintainable,
- easy to extend later.

If you start rebuilding Storyly’s entire product surface, you are building the wrong thing.
