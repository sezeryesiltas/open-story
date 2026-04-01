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
