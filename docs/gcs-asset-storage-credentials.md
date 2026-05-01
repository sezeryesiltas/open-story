# Google Cloud Storage Asset Credentials

Bu doküman OpenStory production ortamında **Cloud Upload** için Google Cloud Storage credential konfigürasyonunu açıklar.

OpenStory credential bilgisini admin panelde veya database içinde saklamaz. API, Google client library üzerinden **Application Default Credentials** kullanır. Bu yüzden credential kaynağı runtime ortamına bağlanmalıdır.

## OpenStory Tarafındaki Ayarlar

Admin Console > **Storage & CDN** ekranında sadece GCS/CDN konfigürasyonu girilir:

```text
Project ID
Bucket
Object prefix
CDN public base URL
Cache-Control
```

Credential burada girilmez.

Prod env default'ları istenirse şu değişkenlerle verilebilir:

```env
OPEN_STORY_GCS_PROJECT_ID=your-project
OPEN_STORY_GCS_BUCKET=open-story-assets-prod
OPEN_STORY_GCS_OBJECT_PREFIX=assets
OPEN_STORY_GCS_PUBLIC_ASSET_BASE_URL=https://assets.example.com
OPEN_STORY_GCS_CACHE_CONTROL=public, max-age=31536000, immutable
```

Google Cloud VM/MIG kullanıyorsanız genellikle bunu set etmeyin:

```env
GOOGLE_APPLICATION_CREDENTIALS=
```

VM service account metadata üzerinden otomatik credential sağlar.

## Service Account ve Bucket Yetkileri

Dedicated service account kullanın. Default Compute Engine service account'a geniş yetkiler vermeyin.

```bash
PROJECT_ID="open-story-493310"
BUCKET_NAME="open-story"
SA_NAME="open-story-assets"
SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

gcloud iam service-accounts create "$SA_NAME" \
  --project "$PROJECT_ID" \
  --display-name="OpenStory Asset Storage"
```

Bucket üzerinde gerekli minimum roller:

```bash
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET_NAME" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.objectAdmin"

gcloud storage buckets add-iam-policy-binding "gs://$BUCKET_NAME" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.bucketViewer"
```

`roles/storage.objectAdmin` object upload/delete için kullanılır. `roles/storage.bucketViewer`, Storage & CDN ekranındaki test akışının bucket metadata kontrolü için gerekir.

## Local Development

Local geliştirme için en kolay yol kullanıcı credential'ı ile ADC üretmektir:

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project "$PROJECT_ID"
```

Prod'a daha yakın test için service account impersonation kullanın:

```bash
gcloud auth application-default login \
  --impersonate-service-account "$SA_EMAIL"
```

Bu yöntemde kendi Google kullanıcınızın service account üzerinde `roles/iam.serviceAccountTokenCreator` yetkisi olmalıdır.

Service account key dosyası sadece son çare olarak kullanılmalıdır:

```bash
mkdir -p ~/.config/open-story

gcloud iam service-accounts keys create ~/.config/open-story/gcs-open-story-assets.json \
  --iam-account="$SA_EMAIL"

export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.config/open-story/gcs-open-story-assets.json"
```

Key dosyasını repo'ya, `.env` dosyasına veya admin database'e koymayın.

## Compute Engine VM

Tekil VM kullanılıyorsa service account doğrudan VM'e bağlanır. Mevcut VM'de service account ve access scope değiştirmek için VM'i durdurmak gerekir.

```bash
PROJECT_ID="your-project"
ZONE="europe-west1-b"
VM_NAME="open-story-prod-vm"
SA_EMAIL="open-story-assets@$PROJECT_ID.iam.gserviceaccount.com"

gcloud compute instances stop "$VM_NAME" \
  --project "$PROJECT_ID" \
  --zone "$ZONE"

gcloud compute instances set-service-account "$VM_NAME" \
  --project "$PROJECT_ID" \
  --zone "$ZONE" \
  --service-account="$SA_EMAIL" \
  --scopes="https://www.googleapis.com/auth/cloud-platform"

gcloud compute instances start "$VM_NAME" \
  --project "$PROJECT_ID" \
  --zone "$ZONE"
```

`cloud-platform` scope kullanın ve gerçek erişim sınırını IAM rollerle bucket seviyesinde tutun.

VM içinde doğrulama:

```bash
curl -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/

curl -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token
```

## Managed Instance Group

Managed Instance Group kullanıyorsanız service account'u tek tek VM'lere bağlamayın. MIG, VM'leri instance template üzerinden recreate eder. Kalıcı ayar **Instance Template** üzerinde olmalıdır.

Doğru model:

```text
Managed Instance Group
  -> Instance Template
    -> Service Account + Access Scope
      -> Yeni oluşturulan tüm VM'ler
```

Instance template immutable olduğu için mevcut template edit edilmez. Yeni template oluşturulur ve MIG rolling update ile bu template'e geçirilir.

### Yeni Template Oluşturma

Mevcut template'in machine type, disk, network, tags, metadata, startup script ve container image ayarlarını koruyarak yeni template oluşturun. Eklenmesi gereken kritik alanlar:

```bash
--service-account="$SA_EMAIL"
--scopes="https://www.googleapis.com/auth/cloud-platform"
```

Normal VM template örneği:

```bash
NEW_TEMPLATE="open-story-api-template-v2"

gcloud compute instance-templates create "$NEW_TEMPLATE" \
  --project "$PROJECT_ID" \
  --machine-type="e2-standard-2" \
  --image-family="debian-12" \
  --image-project="debian-cloud" \
  --boot-disk-size="30GB" \
  --network="default" \
  --tags="http-server,https-server" \
  --metadata-from-file=startup-script=startup.sh \
  --service-account="$SA_EMAIL" \
  --scopes="https://www.googleapis.com/auth/cloud-platform"
```

Container template örneği:

```bash
NEW_TEMPLATE="open-story-api-template-v2"

gcloud compute instance-templates create-with-container "$NEW_TEMPLATE" \
  --project "$PROJECT_ID" \
  --machine-type="e2-standard-2" \
  --container-image="gcr.io/$PROJECT_ID/open-story-api:latest" \
  --container-env="OPEN_STORY_GCS_PROJECT_ID=$PROJECT_ID,OPEN_STORY_GCS_BUCKET=$BUCKET_NAME,OPEN_STORY_GCS_OBJECT_PREFIX=assets,OPEN_STORY_GCS_PUBLIC_ASSET_BASE_URL=https://assets.example.com" \
  --service-account="$SA_EMAIL" \
  --scopes="https://www.googleapis.com/auth/cloud-platform"
```

Google Cloud Console kullanıyorsanız mevcut instance template'i kopyalayıp sadece service account ve access scope alanlarını değiştirmeniz daha güvenlidir.

### MIG Rolling Update

Zonal MIG için:

```bash
MIG_NAME="open-story-api-mig"
ZONE="europe-west1-b"

gcloud compute instance-groups managed rolling-action start-update "$MIG_NAME" \
  --project "$PROJECT_ID" \
  --zone "$ZONE" \
  --version=template="$NEW_TEMPLATE" \
  --max-surge=1 \
  --max-unavailable=0
```

Regional MIG için:

```bash
MIG_NAME="open-story-api-mig"
REGION="europe-west1"

gcloud compute instance-groups managed rolling-action start-update "$MIG_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --version=template="$NEW_TEMPLATE" \
  --max-surge=1 \
  --max-unavailable=0
```

Durumu izlemek için:

```bash
gcloud compute instance-groups managed describe "$MIG_NAME" \
  --project "$PROJECT_ID" \
  --zone "$ZONE"

gcloud compute instance-groups managed list-instances "$MIG_NAME" \
  --project "$PROJECT_ID" \
  --zone "$ZONE"
```

Regional MIG kullanıyorsanız `--zone` yerine `--region` kullanın.

Yeni gelen VM'lerden birine SSH ile girip metadata kontrolünü çalıştırın:

```bash
curl -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/
```

Beklenen çıktı service account email'ini içermelidir.

## Docker-on-VM Notu

API Docker container içinde çalışsa bile VM service account kullanılabilir. Container VM metadata server'a erişebildiği sürece Google client library ADC credential'ı bulur.

Bu durumda container'a service account key mount etmeyin ve `GOOGLE_APPLICATION_CREDENTIALS` vermeyin. GCS bağlantısı metadata server üzerinden gelir.

## Son Doğrulama

API deploy/restart sonrası Admin Console'da:

```text
Storage & CDN -> Google Cloud Storage -> Test et
```

Başarılı olmalıdır. Ardından asset eklerken **Cloud Upload** seçeneği GCS bucket'a yazmalı ve asset URL'i CDN public base URL ile dönmelidir.

## Kaynaklar

- https://cloud.google.com/docs/authentication/application-default-credentials
- https://cloud.google.com/docs/authentication/set-up-adc-local-dev-environment
- https://cloud.google.com/docs/authentication/set-up-adc-attached-service-account
- https://cloud.google.com/compute/docs/access/service-accounts
- https://cloud.google.com/compute/docs/instance-templates
- https://cloud.google.com/compute/docs/instance-groups/rolling-out-updates-to-managed-instance-groups
- https://cloud.google.com/storage/docs/access-control/iam-roles
- https://cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys
