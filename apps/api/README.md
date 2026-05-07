# @open-story/api

Backend API module scaffold.

## Current database behavior

- Production runtime gerçek relational Postgres tablolarını kullanır (`client`, `static_token`, `placement`, `story_group_set`, revision ve composition tabloları).
- API, DB ayarlarını `env -> OPEN_STORY_DB_CONFIG_PATH içindeki bootstrap config dosyası` sırasıyla çözer; local SQLite fallback yalnızca non-production/test kullanım içindir.
- `OPEN_STORY_POSTGRES_*` env değişkenleri aynı alanlar için config dosyası değerlerini override eder.
- `GET /v1/settings/database` aktif provider, Postgres bağlantı özeti ve relational tablo sayılarını döner.
- `PUT /v1/settings/database` ile Postgres bağlantı bilgisi kaydedilir ve relational schema hazır hale getirilir.
- Eski tek tablo Postgres modu, alternatif SQL hedefleri ve migration scripti runtime yüzeyinden kaldırılmıştır.
- Supabase Postgres için SSL mode varsayılanı `require` olmalıdır.

## Asset storage behavior

- Local server upload `POST /v1/assets/upload` ile devam eder ve `OPEN_STORY_ASSET_STORAGE_DIR` altına yazar.
- Cloud upload `POST /v1/assets/cloud-upload` ile aktif Google Cloud Storage veya Supabase Storage S3 bucket hedefini kullanır.
- API, storage ayarlarını `env -> OPEN_STORY_ASSET_STORAGE_CONFIG_PATH içindeki config dosyası -> local disk fallback` sırasıyla çözer.
- Admin `Storage & CDN` ekranı `GET/PUT /v1/settings/storage` ve `POST /v1/settings/storage/test` üzerinden bucket, object prefix ve CDN public base URL ayarlarını yönetir.
- Service account JSON/private key admin DB'ye yazılmaz; API runtime'ı Application Default Credentials veya `GOOGLE_APPLICATION_CREDENTIALS` kullanır.
- Supabase S3 access key bilgileri admin DB'ye değil `asset-storage-config.json` dosyasına yazılır ve yalnızca server-side kullanılır.
- Upload edilen raster PNG görseller JPEG'e çevrilir. Group logo 500x500 sınırına, story image/poster ise yüksekliği en fazla 1600 px olacak şekilde aspect ratio korunarak optimize edilir.
- URL import dış URL'yi korur; bu yol dosyayı Open Story storage hedefine yeniden yazmaz.

## Supported Postgres settings

`PUT /v1/settings/database` payload içinde `postgres` alanı doluysa Postgres hedefi aktif edilir:

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

Password `GET` response içinde geri dönmez; aynı host/port/database/username/sslMode için boş gönderilirse mevcut Postgres password korunur.

## Supported Supabase Storage S3 settings

`PUT /v1/settings/storage` payload içinde `activeProvider: "supabase_s3"` ve `supabaseS3` alanı doluysa Supabase bucket hedefi aktif edilir:

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

Supabase S3 client `forcePathStyle: true` ile çalışır. Secret access key `GET` response içinde dönmez; aynı endpoint/region/bucket/access key için boş gönderilirse mevcut secret korunur.

Production veya multi-instance deploy'da aynı ayarlar env ile de verilebilir:

- `OPEN_STORY_ASSET_STORAGE_PROVIDER=gcs` ile `OPEN_STORY_GCS_*`
- `OPEN_STORY_ASSET_STORAGE_PROVIDER=supabase_s3` ile `OPEN_STORY_SUPABASE_S3_*`

## Admin API keys

Admin API keys are for backend-to-backend access to admin APIs. They are separate from SDK static tokens.

- Create/list/revoke keys with an admin session token:
  - `GET /v1/admin-api-keys`
  - `POST /v1/admin-api-keys` with `{ "clientName": "Content service production" }`
  - `POST /v1/admin-api-keys/:keyId/revoke`
- The create response returns `plainTextApiKey` and `clientSecret` once.
- Use the generated API key on admin API calls as `Authorization: Bearer <plainTextApiKey>`.
- Revoked admin API keys return `403` and cannot render admin API access.
