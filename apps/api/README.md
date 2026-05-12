# @open-story/api

Backend API module scaffold.

## Current database behavior

- Production runtime uses real relational Postgres tables (`client`, `static_token`, `placement`, `story_group_set`, revision, and composition tables).
- The API resolves DB settings in this order: `env -> bootstrap config file inside OPEN_STORY_DB_CONFIG_PATH`; local SQLite fallback is only for non-production/test use.
- `OPEN_STORY_POSTGRES_*` env variables override config file values for the same fields.
- `GET /v1/settings/database` returns the active provider, Postgres connection summary, and relational table counts.
- `PUT /v1/settings/database` saves Postgres connection details and prepares the relational schema.
- The legacy single-table Postgres mode, alternate SQL targets, and migration script have been removed from the runtime surface.
- The default SSL mode for Supabase Postgres should be `require`.

## Asset storage behavior

- Local server upload `POST /v1/assets/upload` works only when the active provider is `local` and writes under `OPEN_STORY_ASSET_STORAGE_DIR`.
- Cloud upload `POST /v1/assets/cloud-upload` uses the active Google Cloud Storage or Supabase Storage S3 bucket target.
- When the active provider is `gcs` or `supabase_s3`, server upload is disabled; new files must be added with Cloud Upload or URL import.
- The API resolves storage settings in this order: `env -> config file inside OPEN_STORY_ASSET_STORAGE_CONFIG_PATH -> local disk fallback`.
- The admin `Storage & CDN` screen manages bucket, object prefix, and CDN public base URL settings through `GET/PUT /v1/settings/storage` and `POST /v1/settings/storage/test`.
- Service account JSON/private key values are not written to the admin DB; the API runtime uses Application Default Credentials or `GOOGLE_APPLICATION_CREDENTIALS`.
- Supabase S3 access key information is written to `asset-storage-config.json`, not the admin DB, and is only used server-side.
- Uploaded raster PNG images are converted to JPEG. Group logos are constrained to 500x500, while story images/posters are optimized with aspect ratio preserved and height capped at 1600 px.
- URL import preserves the external URL; this path does not rewrite the file into the Open Story storage target.

## Supported Postgres settings

If the `postgres` field is filled in the `PUT /v1/settings/database` payload, the Postgres target is activated:

```json
{
  "postgres": {
    "host": "db.project-ref.supabase.co",
    "port": 5432,
    "database": "postgres",
    "username": "postgres",
    "password": "secret",
    "sslMode": "require"
  }
}
```

Password is not returned in the `GET` response; if it is sent empty for the same host/port/database/username/sslMode, the existing Postgres password is preserved.

## Supported Supabase Storage S3 settings

If `activeProvider: "supabase_s3"` and the `supabaseS3` field are filled in the `PUT /v1/settings/storage` payload, the Supabase bucket target is activated:

```json
{
  "activeProvider": "supabase_s3",
  "supabaseS3": {
    "endpoint": "https://project-ref.storage.supabase.co/storage/v1/s3",
    "region": "project_region",
    "bucketName": "open-story-assets",
    "accessKeyId": "access-key-id",
    "secretAccessKey": "secret-access-key",
    "objectPrefix": "assets",
    "publicAssetBaseUrl": "https://project-ref.supabase.co/storage/v1/object/public/open-story-assets",
    "cacheControl": "public, max-age=31536000, immutable"
  }
}
```

The Supabase S3 client runs with `forcePathStyle: true`. Secret access key is not returned in the `GET` response; if it is sent empty for the same endpoint/region/bucket/access key, the existing secret is preserved.

In production or multi-instance deploys, the same settings can also be provided with env:

- `OPEN_STORY_ASSET_STORAGE_PROVIDER=gcs` with `OPEN_STORY_GCS_*`
- `OPEN_STORY_ASSET_STORAGE_PROVIDER=supabase_s3` with `OPEN_STORY_SUPABASE_S3_*`

## Admin API keys

Admin API keys are for backend-to-backend access to admin APIs. They are separate from SDK static tokens.

- Create/list/revoke keys with an admin session token:
  - `GET /v1/admin-api-keys`
  - `POST /v1/admin-api-keys` with `{ "clientName": "Content service production" }`
  - `POST /v1/admin-api-keys/:keyId/revoke`
- The create response returns `plainTextApiKey` and `clientSecret` once.
- Use the generated API key on admin API calls as `Authorization: Bearer <plainTextApiKey>`.
- Revoked admin API keys return `403` and cannot render admin API access.
