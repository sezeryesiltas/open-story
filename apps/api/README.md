# @open-story/api

Backend API module scaffold.

## Current database behavior

- Varsayılan veri kaynağı `apps/api/data/open-story.sqlite` dosyasıdır.
- Aktif DB bağlantı ayarı `apps/api/data/database-config.json` içinde tutulur.
- `GET /v1/settings/database` aktif provider, local SQLite durumu, harici SQLite URL/path ve MySQL bağlantı özetini döner.
- `PUT /v1/settings/database` ile harici SQLite dosya URL/path veya MySQL bağlantı bilgisi tanımlanabilir.
- Harici SQLite URL kaydedildiğinde mevcut aktif SQLite dosyası hedefe kopyalanır ve API o dosya üzerinden çalışmaya devam eder.
- MySQL bağlantı bilgisi kaydedildiğinde aynı `records` snapshot semantiği MySQL `records` tablosuna taşınır ve aktif provider MySQL olur.

## Asset storage behavior

- Local server upload `POST /v1/assets/upload` ile devam eder ve `OPEN_STORY_ASSET_STORAGE_DIR` altına yazar.
- Cloud upload `POST /v1/assets/cloud-upload` ile Google Cloud Storage bucket hedefini kullanır.
- Admin `Storage & CDN` ekranı `GET/PUT /v1/settings/storage` ve `POST /v1/settings/storage/test` üzerinden bucket, object prefix ve CDN public base URL ayarlarını yönetir.
- Service account JSON/private key admin DB'ye yazılmaz; API runtime'ı Application Default Credentials veya `GOOGLE_APPLICATION_CREDENTIALS` kullanır.
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

## Admin API keys

Admin API keys are for backend-to-backend access to admin APIs. They are separate from SDK static tokens.

- Create/list/revoke keys with an admin session token:
  - `GET /v1/admin-api-keys`
  - `POST /v1/admin-api-keys` with `{ "clientName": "Content service production" }`
  - `POST /v1/admin-api-keys/:keyId/revoke`
- The create response returns `plainTextApiKey` and `clientSecret` once.
- Use the generated API key on admin API calls as `Authorization: Bearer <plainTextApiKey>`.
- Revoked admin API keys return `403` and cannot render admin API access.
