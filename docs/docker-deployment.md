# Docker Deployment Guide

Open Story'yi tek bir sunucuda Docker Compose ile, ama `api` ve `admin-web` ayrı service olacak şekilde çalıştırmak için bu akışı kullanın.

## Topoloji

```text
Internet
  -> nginx
    -> /                -> admin-web:3000
    -> /api/*           -> admin-web:3000
    -> /v1/*            -> api:3001
    -> /uploads/assets/* -> api:3001

Host bind mounts
  /opt/open-story/data   -> /data/db
  /opt/open-story/assets -> /data/assets
```

Bu yapı tek VM üzerinde çalışır. Ayrı Docker service kullanılır, ayrı VM gerekmez.

## Neden Bu Yapı

- `api` veritabanı ve asset storage'ın tek sahibidir.
- `admin-web` DB açmaz; tüm admin isteklerini API'ye proxy eder.
- `localhost` bağımlılığı kalkar; container içi bağlantı adı `http://api:3001` olur.
- PM2 ile tek container içinde iki process yönetme ihtiyacı ortadan kalkar.

## Gereksinimler

- Docker Engine 20+
- Docker Compose v2+
- En az 2 GB RAM
- En az 10 GB disk

## 1. Repo ve Branch

```bash
git clone https://github.com/sezeryesiltas/open-story.git
cd open-story
git checkout codex/admin-web-prod-ready
```

## 2. Host Dizinleri

```bash
sudo mkdir -p /opt/open-story/data /opt/open-story/assets
sudo chown -R $(id -u):$(id -g) /opt/open-story
```

## 3. Compose Env

Docker Compose host path interpolasyonu için:

```bash
cp .env.compose.example .env
```

Gerekirse `.env` içeriğini düzenleyin:

```env
OPEN_STORY_HOST_DATA_DIR=/opt/open-story/data
OPEN_STORY_HOST_ASSETS_DIR=/opt/open-story/assets
```

Bu dosya container içine girmez; sadece Compose tarafından okunur.

## 4. Runtime Env

```bash
cp .env.production.example .env.production
```

Minimum production ayarları:

```env
NODE_ENV=production
OPEN_STORY_API_PORT=3001
OPEN_STORY_SQLITE_PATH=/data/db/open-story.sqlite
OPEN_STORY_DB_CONFIG_PATH=/data/db/database-config.json
OPEN_STORY_ASSET_STORAGE_DIR=/data/assets
OPEN_STORY_PUBLIC_ASSET_BASE_URL=https://openstory.cloud/uploads/assets
OPEN_STORY_API_BASE_URL=http://api:3001
OPEN_STORY_COOKIE_SECURE=true
```

Notlar:

- `OPEN_STORY_PUBLIC_ASSET_BASE_URL` dışarıdan erişilen gerçek domain olmalı.
- HTTPS load balancer arkasında `OPEN_STORY_COOKIE_SECURE=true` kullanın.
- Sadece düz HTTP ile test ediyorsanız `OPEN_STORY_COOKIE_SECURE=false` yapın.

## 5. Build ve Başlat

```bash
docker compose build --no-cache
docker compose up -d
```

## 6. Durum Kontrolü

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f admin-web
docker compose logs -f nginx
```

Servislerin `Up` durumda görünmesi gerekir:

- `api`
- `admin-web`
- `nginx`

## 7. Test

Admin:

```text
https://openstory.cloud
```

Varsayılan giriş:

- Email: `admin@openstory.local`
- Şifre: `admin123`

API kontrolü:

```bash
curl https://openstory.cloud/v1/sdk/feed \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"client_id":"test","placement_key":"test","platform":"ios","app_version":"1.0.0","user_segments":[]}'
```

Token eksik olduğu için `401` dönmesi API'nin erişilebilir olduğunu gösterir.

## Güncelleme

```bash
git pull
docker compose build --no-cache
docker compose up -d --force-recreate
```

## Sorun Giderme

Login hatası:

- `docker compose logs -f admin-web`
- `docker compose logs -f api`
- Browser Network tab'da `/api/auth/login` response body

Asset görünmüyor:

- `OPEN_STORY_PUBLIC_ASSET_BASE_URL` doğru domain olmalı
- `docker compose logs -f api`

Veritabanını sıfırlama:

```bash
rm -f /opt/open-story/data/open-story.sqlite
rm -f /opt/open-story/data/database-config.json
docker compose restart api
```

## Dosyalar

```text
open-story/
├── .env.compose.example
├── .env.production.example
├── docker-compose.yml
├── Dockerfile
└── nginx/default.conf
```
