# Docker Deployment Guide

Open Story platformunu Docker ile tek bir sunucuda çalıştırmak için gereken adımlar.

## Mimari

```
┌─────────────────────────────────────────────┐
│  Host Machine                               │
│                                             │
│  ┌───────────┐      ┌────────────────────┐  │
│  │  Nginx    │:80   │  App Container     │  │
│  │  (proxy)  │─────▶│  ┌──────────────┐  │  │
│  │           │  /   │  │ Admin Web    │  │  │
│  │           │──────│  │ (Next.js)    │  │  │
│  │           │      │  │ :3000        │  │  │
│  │           │      │  └──────────────┘  │  │
│  │           │ /v1/ │  ┌──────────────┐  │  │
│  │           │──────│  │ API          │  │  │
│  │           │      │  │ (NestJS+tsx) │  │  │
│  │           │      │  │ :3001        │  │  │
│  │           │      │  └──────────────┘  │  │
│  └───────────┘      └────────┬───────────┘  │
│                              │              │
│          ┌───────────────────┘              │
│          ▼                                  │
│  /opt/open-story/                           │
│    ├── data/        ← SQLite DB + config    │
│    └── assets/      ← Yüklenen medya        │
└─────────────────────────────────────────────┘
```

- **Nginx**: Reverse proxy — port 80'den gelen istekleri yönlendirir
- **App Container**: PM2 ile Admin Web (Next.js) ve API (NestJS) birlikte çalışır
- **Bind Mounts**: Veritabanı ve medya dosyaları host dosya sisteminde saklanır

## Gereksinimler

- Docker Engine 20+
- Docker Compose v2+
- En az 2 GB RAM (e2-small veya dengi)
- En az 10 GB disk (20 GB önerilir)

## 1. Proje Kurulumu

```bash
# Projeyi klonla
git clone https://github.com/sezeryesiltas/open-story.git
cd open-story

# Deploy branch'ine geç
git checkout codex/admin-web-prod-ready
```

## 2. Host Klasörlerini Oluştur

Veritabanı ve asset dosyaları container dışında, host makinada saklanır:

```bash
sudo mkdir -p /opt/open-story/data /opt/open-story/assets
sudo chown -R $(id -u):$(id -g) /opt/open-story
```

## 3. Ortam Değişkenlerini Yapılandır

### `.env` (docker-compose bind mount path'leri için)

Proje kökünde `.env` dosyası oluştur:

```bash
cat > .env <<'EOF'
OPEN_STORY_HOST_DATA_DIR=/opt/open-story/data
OPEN_STORY_HOST_ASSETS_DIR=/opt/open-story/assets
EOF
```

> **Not:** Bu dosya docker-compose'un `${VAR}` interpolasyonu için kullanılır. Container'a geçmez.

### `.env.production` (uygulama ayarları için)

```bash
cp .env.production.example .env.production
```

`.env.production` dosyasını düzenle:

```env
NODE_ENV=production
OPEN_STORY_API_PORT=3001

# Container-içi path'ler (bind mount hedefleriyle eşleşmeli)
OPEN_STORY_SQLITE_PATH=/data/db/open-story.sqlite
OPEN_STORY_DB_CONFIG_PATH=/data/db/database-config.json
OPEN_STORY_ASSET_STORAGE_DIR=/data/assets

# Public asset URL — IP veya domain adresini yaz
OPEN_STORY_PUBLIC_ASSET_BASE_URL=http://<SUNUCU_IP>/uploads/assets

# Admin Web → API bağlantısı (aynı container içinde)
OPEN_STORY_API_BASE_URL=http://localhost:3001

# HTTPS yoksa false yap, HTTPS varsa bu satırı sil
OPEN_STORY_COOKIE_SECURE=false
```

`<SUNUCU_IP>` yerine sunucunun gerçek IP adresini veya domain'ini yaz.

## 4. Build & Başlat

```bash
docker compose build --no-cache
docker compose up -d
```

İlk build birkaç dakika sürebilir.

## 5. Durumu Kontrol Et

```bash
# Container'ların çalıştığını doğrula
docker compose ps

# Uygulama loglarını izle
docker compose logs -f app

# API ve Admin Web'in ayağa kalktığını kontrol et
docker compose exec app pm2 list
```

Beklenen PM2 çıktısı:

```
┌────┬──────────────────────┬──────┬───────┐
│ id │ name                 │ mode │ status│
├────┼──────────────────────┼──────┼───────┤
│ 0  │ open-story-api       │ fork │ online│
│ 1  │ open-story-admin     │ fork │ online│
└────┴──────────────────────┴──────┴───────┘
```

## 6. Test

### Admin Web

Tarayıcıda aç:

```
http://<SUNUCU_IP>
```

Login sayfası görünmelidir.

### Varsayılan Giriş Bilgileri

| Alan  | Değer                  |
|-------|------------------------|
| Email | `admin@openstory.local`|
| Şifre | `admin123`             |

İlk girişte şifre değiştirme zorunludur.

### API Health Check

```bash
curl http://<SUNUCU_IP>/v1/sdk/feed \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"client_id":"test","placement_key":"test","platform":"ios","app_version":"1.0.0","user_segments":[]}'
```

401 dönüyorsa API çalışıyor demektir (token eksik olduğu için beklenen davranış).

### Tam Akış Testi

1. `http://<SUNUCU_IP>` → Login yap
2. **Client** oluştur → Static token al
3. **Placement** oluştur
4. **StoryGroupSet** → **StoryGroup** → **Story** oluştur
5. Asset yükle
6. Publish et
7. SDK feed endpoint'ini static token ile çağır:

```bash
curl -X POST http://<SUNUCU_IP>/v1/sdk/feed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <STATIC_TOKEN>" \
  -d '{
    "client_id": "<CLIENT_ID>",
    "placement_key": "<PLACEMENT_KEY>",
    "platform": "ios",
    "app_version": "1.0.0",
    "user_segments": []
  }'
```

Feed verisi dönüyorsa tüm akış çalışıyor demektir.

## Güncelleme

```bash
git pull
docker compose build --no-cache
docker compose down && docker compose up -d
```

Veritabanı ve asset'ler host'taki `/opt/open-story/` altında korunur.

## Yeniden Başlatma

```bash
# Tüm container'ları yeniden başlat
docker compose restart

# Sadece app container'ını yeniden başlat
docker compose restart app
```

## Loglar

```bash
# Tüm loglar
docker compose logs -f

# Sadece app logları
docker compose logs -f app

# Sadece nginx logları
docker compose logs -f nginx
```

## Sorun Giderme

### Disk dolu hatası

```bash
docker system prune -a --volumes -f
```

### Cookie/session sorunu (login sonrası tekrar login'e dönüyor)

`.env.production`'da `OPEN_STORY_COOKIE_SECURE=false` olduğundan emin ol (HTTPS yoksa).

### Asset'ler görünmüyor

`OPEN_STORY_PUBLIC_ASSET_BASE_URL` değerinin doğru IP/domain içerdiğini kontrol et.

### Veritabanı sıfırlama

```bash
# Dikkat: tüm veriyi siler
rm /opt/open-story/data/open-story.sqlite
rm /opt/open-story/data/database-config.json
docker compose restart app
```

## Dosya Yapısı

```
open-story/
├── .env                          # Docker Compose bind mount path'leri
├── .env.production               # Uygulama ortam değişkenleri
├── .env.production.example       # Örnek ortam dosyası
├── docker-compose.yml            # Container orchestration
├── Dockerfile                    # Multi-stage build
├── ecosystem.config.cjs          # PM2 process config
└── nginx/
    └── default.conf              # Nginx reverse proxy config
```

## Port Yönlendirme

| Yol               | Hedef          | Açıklama                    |
|--------------------|----------------|-----------------------------|
| `/`               | app:3000       | Admin Web (Next.js)         |
| `/api/*`          | app:3000       | Next.js API Routes          |
| `/v1/*`           | app:3001       | SDK Feed API (NestJS)       |
| `/uploads/assets/`| app:3001       | Statik medya dosyaları      |

## Firewall

80 (HTTP) ve isteğe bağlı 443 (HTTPS) portlarının açık olduğundan emin ol.

GCP örneği:

```bash
gcloud compute firewall-rules create allow-http \
  --allow tcp:80 --target-tags=http-server
```
