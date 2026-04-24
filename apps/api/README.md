# @open-story/api

Backend API module scaffold.

## Current database behavior

- Varsayılan veri kaynağı `apps/api/data/open-story.sqlite` dosyasıdır.
- Aktif DB bağlantı ayarı `apps/api/data/database-config.json` içinde tutulur.
- `GET /v1/settings/database` aktif/local sqlite durumunu döner.
- `PUT /v1/settings/database` ile harici sqlite dosya URL/path tanımlanabilir.
- Harici URL kaydedildiğinde mevcut aktif sqlite dosyası hedefe kopyalanır ve API o dosya üzerinden çalışmaya devam eder.

## Supported external DB formats

- `file:///absolute/path/open-story.sqlite`
- `sqlite:///absolute/path/open-story.sqlite`
- `/absolute/path/open-story.sqlite`

## Admin API keys

Admin API keys are for backend-to-backend access to admin APIs. They are separate from SDK static tokens.

- Create/list/revoke keys with an admin session token:
  - `GET /v1/admin-api-keys`
  - `POST /v1/admin-api-keys` with `{ "clientName": "Content service production" }`
  - `POST /v1/admin-api-keys/:keyId/revoke`
- The create response returns `plainTextApiKey` and `clientSecret` once.
- Use the generated API key on admin API calls as `Authorization: Bearer <plainTextApiKey>`.
- Revoked admin API keys return `403` and cannot render admin API access.
