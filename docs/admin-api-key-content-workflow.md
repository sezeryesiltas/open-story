# Admin API Key Content Workflow

This guide shows how a backend service can use an Admin API key to create Story Groups and Stories, then publish them.

Admin API keys are for backend-to-backend admin API access. They are different from SDK static tokens.

## Prerequisites

1. Generate an Admin API key in the Admin Console:
   - Open `Client ve token yönetimi`.
   - Use `Yeni admin API key`.
   - Save the generated `plainTextApiKey`; it is shown only once.

2. Set local shell variables:

```bash
export OPEN_STORY_API_BASE_URL="http://localhost:3001"
export OPEN_STORY_ADMIN_API_KEY="<plainTextApiKey>"
```

3. Use this auth header for admin content APIs:

```http
Authorization: Bearer <plainTextApiKey>
```

The separate `clientSecret` is returned for operator visibility at creation time. API requests use the generated `plainTextApiKey`.

## Content Visibility Rules

Creating records is not enough for SDK visibility.

A Story appears in the SDK feed only after:

1. the Story is published,
2. the Story Group composition containing that Story is published,
3. the Story Group is included in a published Story Group Set,
4. the matching placement/context resolves to that published set.

If you add a Story to an already published group, publish the Story and then publish the Group again because group composition changed.

## 1. Create Or Reuse Assets

A Story Group requires a square `group_logo` asset. Image stories require a 9:16 `story_image` asset. Video stories require a `story_video` asset and a `story_poster` asset.

Import assets by URL:

```bash
curl -sS -X POST "$OPEN_STORY_API_BASE_URL/v1/assets/import" \
  -H "Authorization: Bearer $OPEN_STORY_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "group_logo",
    "url": "https://cdn.example.com/open-story/logo.png"
  }'
```

```bash
curl -sS -X POST "$OPEN_STORY_API_BASE_URL/v1/assets/import" \
  -H "Authorization: Bearer $OPEN_STORY_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "story_image",
    "url": "https://cdn.example.com/open-story/story-1.png"
  }'
```

Or upload files with multipart:

```bash
curl -sS -X POST "$OPEN_STORY_API_BASE_URL/v1/assets/upload" \
  -H "Authorization: Bearer $OPEN_STORY_ADMIN_API_KEY" \
  -F "type=story_image" \
  -F "file=@./story-1.png"
```

Useful asset list calls:

```bash
curl -sS "$OPEN_STORY_API_BASE_URL/v1/assets?type=group_logo" \
  -H "Authorization: Bearer $OPEN_STORY_ADMIN_API_KEY"

curl -sS "$OPEN_STORY_API_BASE_URL/v1/assets?type=story_image" \
  -H "Authorization: Bearer $OPEN_STORY_ADMIN_API_KEY"
```

## 2. Create A Story Group

Use the `id` of a `group_logo` asset as `logo_asset_id`.

```bash
curl -sS -X POST "$OPEN_STORY_API_BASE_URL/v1/story-groups" \
  -H "Authorization: Bearer $OPEN_STORY_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Spring Campaign",
    "bottom_label": "New",
    "logo_asset_id": "<group_logo_asset_id>",
    "badge": null,
    "story_ids": []
  }'
```

Response fields to keep:

```json
{
  "id": "<story_group_id>",
  "current_draft_revision_id": "<group_draft_revision_id>",
  "current_published_revision_id": null,
  "story_ids": []
}
```

## 3. Create A Story In The Group

Creating a Story automatically appends it to the target group draft composition.

Image Story:

```bash
curl -sS -X POST "$OPEN_STORY_API_BASE_URL/v1/stories" \
  -H "Authorization: Bearer $OPEN_STORY_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "group_id": "<story_group_id>",
    "name": "Spring Hero",
    "media_type": "image",
    "asset_id": "<story_image_asset_id>",
    "poster_asset_id": null,
    "image_duration_ms": 5000,
    "cta": {
      "label": "Open",
      "type": "deeplink",
      "value": "myapp://spring"
    }
  }'
```

Video Story:

```bash
curl -sS -X POST "$OPEN_STORY_API_BASE_URL/v1/stories" \
  -H "Authorization: Bearer $OPEN_STORY_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "group_id": "<story_group_id>",
    "name": "Spring Video",
    "media_type": "video",
    "asset_id": "<story_video_asset_id>",
    "poster_asset_id": "<story_poster_asset_id>",
    "image_duration_ms": null,
    "cta": null
  }'
```

Response fields to keep:

```json
{
  "id": "<story_id>",
  "current_draft_revision_id": "<story_draft_revision_id>",
  "current_published_revision_id": null,
  "group_id": "<story_group_id>"
}
```

## 4. Publish The Story

Publish the Story draft revision:

```bash
curl -sS -X POST "$OPEN_STORY_API_BASE_URL/v1/stories/<story_id>/publish" \
  -H "Authorization: Bearer $OPEN_STORY_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "expected_draft_revision_id": "<story_draft_revision_id>"
  }'
```

`expected_draft_revision_id` is optional, but using it protects your integration from accidentally publishing a newer draft created by another process.

## 5. Publish The Story Group

Because creating the Story changed group composition, publish the Story Group draft:

```bash
curl -sS -X POST "$OPEN_STORY_API_BASE_URL/v1/story-groups/<story_group_id>/publish" \
  -H "Authorization: Bearer $OPEN_STORY_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "expected_draft_revision_id": "<group_draft_revision_id_after_story_create>"
  }'
```

Important: after Story creation, fetch the Story Group or use the returned group state from your own workflow to get the latest `current_draft_revision_id`.

```bash
curl -sS "$OPEN_STORY_API_BASE_URL/v1/story-groups/<story_group_id>" \
  -H "Authorization: Bearer $OPEN_STORY_ADMIN_API_KEY"
```

## 6. Attach The Group To A Story Group Set

If the group is already part of a published set, skip to validation.

Otherwise, add the group to a Story Group Set and publish that set. You need a `placement_id`.

List placements:

```bash
curl -sS "$OPEN_STORY_API_BASE_URL/v1/placements" \
  -H "Authorization: Bearer $OPEN_STORY_ADMIN_API_KEY"
```

Create a new set:

```bash
curl -sS -X POST "$OPEN_STORY_API_BASE_URL/v1/story-group-sets" \
  -H "Authorization: Bearer $OPEN_STORY_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "placement_id": "<placement_id>",
    "name": "Home Story Bar",
    "is_fallback": false,
    "targets": [
      {
        "platform": "ios",
        "min_app_version": "1.0.0"
      },
      {
        "platform": "android",
        "min_app_version": "1.0.0"
      }
    ],
    "segments": [],
    "group_ids": ["<story_group_id>"]
  }'
```

Publish the set:

```bash
curl -sS -X POST "$OPEN_STORY_API_BASE_URL/v1/story-group-sets/<story_group_set_id>/publish" \
  -H "Authorization: Bearer $OPEN_STORY_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "expected_draft_revision_id": "<set_draft_revision_id>"
  }'
```

To add the group to an existing set, first read the set, then patch `group_ids` with the full desired order:

```bash
curl -sS "$OPEN_STORY_API_BASE_URL/v1/story-group-sets/<story_group_set_id>" \
  -H "Authorization: Bearer $OPEN_STORY_ADMIN_API_KEY"
```

```bash
curl -sS -X PATCH "$OPEN_STORY_API_BASE_URL/v1/story-group-sets/<story_group_set_id>" \
  -H "Authorization: Bearer $OPEN_STORY_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "group_ids": ["<existing_group_id>", "<story_group_id>"]
  }'
```

Then publish the set again.

## 7. Validate Through SDK Feed Resolution

SDK feed auth still uses the SDK static token, not the Admin API key.

```bash
curl -sS -X POST "$OPEN_STORY_API_BASE_URL/v1/sdk/feed" \
  -H "Authorization: Bearer <sdk_static_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "public-client-id",
    "placement_key": "home_top_story_bar",
    "platform": "ios",
    "app_version": "1.0.0",
    "user_segments": []
  }'
```

The published group should appear under `resolved_set.groups`, and the published story should appear under that group's `stories`.

## Common Failure Cases

- `401 Invalid admin API key`: the key was copied incorrectly or the request is using the `clientSecret` alone instead of `plainTextApiKey`.
- `403 Admin API key is revoked or inactive`: generate a new Admin API key or restore the integration config.
- `400 logo_asset_id must reference an uploaded group logo asset`: use an asset with type `group_logo`.
- `400 Image story must reference a story_image asset`: use an asset with type `story_image`.
- `400 Video story requires poster_asset_id`: video stories must include a `story_poster` asset.
- Story is created and published but not visible: publish the Story Group after composition changes, then ensure the group is included in a published Story Group Set.
- Set publish fails with targeting ambiguity: adjust platform/version/segment rules so the same request cannot match overlapping published sets.

## Minimal Sequence

```text
1. Import/upload group_logo asset
2. Import/upload story_image or story_video + story_poster assets
3. POST /v1/story-groups
4. POST /v1/stories
5. POST /v1/stories/:storyId/publish
6. GET /v1/story-groups/:groupId
7. POST /v1/story-groups/:groupId/publish
8. Create/update Story Group Set with the group id
9. POST /v1/story-group-sets/:setId/publish
10. Validate with POST /v1/sdk/feed using SDK static token
```
