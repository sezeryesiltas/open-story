# @open-story/api

Backend API module scaffold.

## Current database behavior

- Varsayılan veri kaynağı `apps/api/data/open-story.sqlite` dosyasıdır.
- Aktif DB bağlantı ayarı `apps/api/data/database-config.json` içinde tutulur.
- `GET /v1/settings/database` aktif provider, local SQLite durumu, harici SQLite URL/path, MySQL ve Postgres bağlantı özetini döner.
- `PUT /v1/settings/database` ile harici SQLite dosya URL/path, MySQL veya Postgres bağlantı bilgisi tanımlanabilir.
- Harici SQLite URL kaydedildiğinde mevcut aktif SQLite dosyası hedefe kopyalanır ve API o dosya üzerinden çalışmaya devam eder.
- MySQL bağlantı bilgisi kaydedildiğinde aynı `records` snapshot semantiği MySQL `records` tablosuna taşınır ve aktif provider MySQL olur.
- Postgres bağlantı bilgisi kaydedildiğinde varsayılan davranış geriye uyumluluk için aynı `records` snapshot semantiğini kullanır.
- `OPEN_STORY_POSTGRES_STORAGE_MODE=relational` ayarı açıkken aktif Postgres hedefi gerçek relational tabloları kullanır (`client`, `static_token`, `placement`, `story_group_set`, revision ve composition tabloları).
- Supabase Postgres için SSL mode varsayılanı `require` olmalıdır.

## Postgres relational migration

Canlı ortamda mevcut `records` verisini relational tablolara taşımak için:

1. Supabase backup alın ve admin yazma işlemlerini bakım moduna alın.
2. API container'ında mevcut Postgres provider aktifken şu komutu çalıştırın:

```bash
PATH="$HOME/.local/bin:$PATH" pnpm --filter @open-story/db migrate:postgres:relational
```

3. API runtime env içine `OPEN_STORY_POSTGRES_STORAGE_MODE=relational` ekleyip API'yi yeniden deploy edin.
4. `records` tablosunu rollback snapshot olarak tutun; stabilizasyon tamamlanmadan silmeyin.

Migration, current draft/published olmayan eski revision'lardaki eksik asset referanslarını import dışında bırakır. Current draft/published revision eksik asset'e bakıyorsa migration durur; bu içerik canlı feed/admin davranışını etkileyebileceği için önce içerik ya da asset kaydı düzeltilmelidir.

## Asset storage behavior

- Local server upload `POST /v1/assets/upload` ile devam eder ve `OPEN_STORY_ASSET_STORAGE_DIR` altına yazar.
- Cloud upload `POST /v1/assets/cloud-upload` ile aktif Google Cloud Storage veya Supabase Storage S3 bucket hedefini kullanır.
- Admin `Storage & CDN` ekranı `GET/PUT /v1/settings/storage` ve `POST /v1/settings/storage/test` üzerinden bucket, object prefix ve CDN public base URL ayarlarını yönetir.
- Service account JSON/private key admin DB'ye yazılmaz; API runtime'ı Application Default Credentials veya `GOOGLE_APPLICATION_CREDENTIALS` kullanır.
- Supabase S3 access key bilgileri admin DB'ye değil `asset-storage-config.json` dosyasına yazılır ve yalnızca server-side kullanılır.
- Upload edilen raster PNG görseller JPEG'e çevrilir. Group logo 500x500 sınırına, story image/poster ise yüksekliği en fazla 1600 px olacak şekilde aspect ratio korunarak optimize edilir.
- URL import dış URL'yi korur; bu yol dosyayı Open Story storage hedefine yeniden yazmaz.

## Supported external DB formats

- `file:///absolute/path/open-story.sqlite`
- `sqlite:///absolute/path/open-story.sqlite`
- `/absolute/path/open-story.sqlite`

## Supported MySQL settings

`PUT /v1/settings/database` payload içinde `mysql` alanı doluysa MySQL hedefi aktif edilir:

```json
{
  "mysql": {
    "host": "mysql.example.internal",
    "port": 3306,
    "database": "open_story",
    "username": "open_story_user",
    "password": "secret"
  }
}
```

Password `GET` response içinde geri dönmez; aynı host/port/database/username için boş gönderilirse mevcut password korunur.

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

## Admin API keys

Admin API keys are for backend-to-backend access to admin APIs. They are separate from SDK static tokens.

- Create/list/revoke keys with an admin session token:
  - `GET /v1/admin-api-keys`
  - `POST /v1/admin-api-keys` with `{ "clientName": "Content service production" }`
  - `POST /v1/admin-api-keys/:keyId/revoke`
- The create response returns `plainTextApiKey` and `clientSecret` once.
- Use the generated API key on admin API calls as `Authorization: Bearer <plainTextApiKey>`.
- Revoked admin API keys return `403` and cannot render admin API access.
