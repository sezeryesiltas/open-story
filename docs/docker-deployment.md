# Docker Deployment Guide

Open Story'yi tek bir sunucuda Docker Compose ile, ama `api` ve `admin-web` ayrı service olacak şekilde çalıştırmak için bu akışı kullanın.

## Topoloji

```text
Internet
  -> HTTPS Load Balancer
    -> nginx (HTTP :80 only)
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

## 1. Repo

```bash
git clone https://github.com/sezeryesiltas/open-story.git
cd open-story
git switch main
git pull --ff-only origin main
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
OPEN_STORY_BUILD_NUMBER=local
```

Bu dosya container içine girmez; sadece Compose tarafından okunur.
`OPEN_STORY_BUILD_NUMBER`, admin sidebar footer'ında gösterilen build bilgisidir. Cloud Build bunu `$SHORT_SHA` ile otomatik verir; Docker Compose ile deploy ederken bu değeri güncel commit kısa SHA'sı veya release numarasıyla değiştirin.

Cloud Build ile üretilmiş image'ları pull ederek deploy edecekseniz aynı `.env` dosyasına image referanslarını da ekleyin:

```env
OPEN_STORY_API_IMAGE=gcr.io/open-story-493310/github.com/sezeryesiltas/open-story-api:latest
OPEN_STORY_ADMIN_WEB_IMAGE=gcr.io/open-story-493310/github.com/sezeryesiltas/open-story-admin-web:latest
```

İsterseniz burada `:latest` de kullanabilirsiniz. Daha deterministik deploy için yine de SHA tag'leri önerilir.

## 4. Runtime Env

```bash
cp .env.production.example .env.production
```

Minimum production ayarları:

```env
NODE_ENV=production
OPEN_STORY_API_PORT=3001
OPEN_STORY_DB_CONFIG_PATH=/data/db/database-config.json
OPEN_STORY_POSTGRES_HOST=db.project-ref.supabase.co
OPEN_STORY_POSTGRES_PORT=5432
OPEN_STORY_POSTGRES_DATABASE=postgres
OPEN_STORY_POSTGRES_USERNAME=postgres
OPEN_STORY_POSTGRES_PASSWORD=<postgres-password>
OPEN_STORY_POSTGRES_SSL_MODE=require
OPEN_STORY_DB_READ_CACHE_TTL_MS=60000
OPEN_STORY_ASSET_STORAGE_CONFIG_PATH=/data/db/asset-storage-config.json
OPEN_STORY_ASSET_STORAGE_DIR=/data/assets
OPEN_STORY_PUBLIC_ASSET_BASE_URL=https://openstory.cloud/uploads/assets
OPEN_STORY_API_BASE_URL=http://api:3001
OPEN_STORY_COOKIE_SECURE=true
```

Notlar:

- `OPEN_STORY_PUBLIC_ASSET_BASE_URL` dışarıdan erişilen gerçek domain olmalı.
- Supabase/Postgres production kullanımında `OPEN_STORY_POSTGRES_*` değişkenleri dolu olmalı; API relational tabloları otomatik hazırlar.
- SDK trafiği altında tekrar eden snapshot okumalarını azaltmak için `OPEN_STORY_DB_READ_CACHE_TTL_MS=60000` önerilir.
- Production ortamında yüksek medya trafiği için Admin Console `Storage & CDN` ekranından Google Cloud Storage veya Supabase Storage S3 provider'ını etkinleştirin ve asset domainini CDN public URL olarak kullanın.
- Google Cloud credential'larını admin ayarlarına yazmayın; API container'ına Application Default Credentials veya `GOOGLE_APPLICATION_CREDENTIALS` ile verin.
- Supabase Storage S3 kullanıyorsanız endpoint, region, bucket, S3 access key ID ve secret access key değerlerini Storage & CDN ekranından girin. Endpoint formatı Supabase tarafında `https://project-ref.storage.supabase.co/storage/v1/s3` şeklindedir.
- Google Cloud VM, Managed Instance Group ve local ADC credential yönergeleri için `docs/gcs-asset-storage-credentials.md` dokümanını kullanın.
- HTTPS load balancer arkasında `OPEN_STORY_COOKIE_SECURE=true` kullanın.
- Sadece düz HTTP ile test ediyorsanız `OPEN_STORY_COOKIE_SECURE=false` yapın.
- Load balancer SSL terminate ettiği için container tarafında ayrıca `443` dinlemeyin.

## 5. Local Build ve Başlat

```bash
docker compose build --no-cache
docker compose up -d
```

## 6. Cloud Build ile Image Üretip VM'de Pull Etme

Cloud Build artık iki ayrı runnable image üretir:

- `open-story-api`
- `open-story-admin-web`

Build:

```bash
gcloud builds submit --config cloudbuild.yaml
```

Build tamamlandığında aynı commit için şu tag'ler push edilir:

- `gcr.io/open-story-493310/github.com/sezeryesiltas/open-story-api:$COMMIT_SHA`
- `gcr.io/open-story-493310/github.com/sezeryesiltas/open-story-api:$SHORT_SHA`
- `gcr.io/open-story-493310/github.com/sezeryesiltas/open-story-api:latest`
- `gcr.io/open-story-493310/github.com/sezeryesiltas/open-story-admin-web:$COMMIT_SHA`
- `gcr.io/open-story-493310/github.com/sezeryesiltas/open-story-admin-web:$SHORT_SHA`
- `gcr.io/open-story-493310/github.com/sezeryesiltas/open-story-admin-web:latest`

VM üstünde `.env` dosyasındaki image ref'lerini güncelleyin, sonra prebuilt image deploy compose dosyasını kullanın:

```bash
docker compose -f docker-compose.deploy.yml pull
docker compose -f docker-compose.deploy.yml up -d
```

Bu akışta:

- `OPEN_STORY_HOST_DATA_DIR` ve `OPEN_STORY_HOST_ASSETS_DIR` sadece VM tarafında gerekir.
- `.env.production` içindeki runtime env'ler aynen kullanılmaya devam eder.
- Cloud Build'e host path env vermen gerekmez; build konteyneri bu mount'ları kullanmaz.

## 7. Durum Kontrolü

```bash
docker compose -f docker-compose.deploy.yml ps
docker compose -f docker-compose.deploy.yml logs -f api
docker compose -f docker-compose.deploy.yml logs -f admin-web
docker compose -f docker-compose.deploy.yml logs -f nginx
```

Servislerin `Up` durumda görünmesi gerekir:

- `api`
- `admin-web`
- `nginx`

Local build ile devam ediyorsanız aynı komutları `docker compose ...` olarak da çalıştırabilirsiniz.

## 8. Test

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

Health check:

```bash
curl http://127.0.0.1/healthz
```

`200 OK` dönmelidir.

## Güncelleme

```bash
git switch main
git pull --ff-only origin main
OPEN_STORY_BUILD_NUMBER=$(git rev-parse --short HEAD) docker compose build --no-cache
docker compose up -d --force-recreate
```

Cloud Build tabanlı güncelleme için:

```bash
gcloud builds submit --config cloudbuild.yaml

# VM üzerinde .env içindeki image tag'lerini yeni SHA ile güncelleyin.
docker compose -f docker-compose.deploy.yml pull
docker compose -f docker-compose.deploy.yml up -d
```

## Sorun Giderme

Login hatası:

- `docker compose -f docker-compose.deploy.yml logs -f admin-web`
- `docker compose -f docker-compose.deploy.yml logs -f api`
- Browser Network tab'da `/api/auth/login` response body
- GCP backend service protocol/port ayarı `HTTP :80` olmalı
- GCP health check `HTTP :80` ve path `/healthz` olmalı
- HTTPS sertifikası load balancer üzerinde terminate edilmeli; backend'e `443` ile gitmeyin

Asset görünmüyor:

- `OPEN_STORY_PUBLIC_ASSET_BASE_URL` doğru domain olmalı
- `docker compose -f docker-compose.deploy.yml logs -f api`

Veritabanını sıfırlama:

```bash
rm -f /opt/open-story/data/database-config.json
docker compose -f docker-compose.deploy.yml restart api
```

Local build compose dosyasıyla çalışıyorsanız son komutu `docker compose restart api` olarak kullanın.

## Dosyalar

```text
open-story/
├── .env.compose.example
├── .env.production.example
├── docker-compose.yml
├── docker-compose.deploy.yml
├── Dockerfile
└── nginx/default.conf
```
