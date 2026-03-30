# PRD — Story Bar Platform (Final)

## 1. Belge amacı

Bu doküman, Codex'e verilecek ürün ve teknik kapsamı netleştirmek için hazırlanmıştır.

Hedef; Storyly benzeri çok geniş bir interactive content platformu kurmak değil, yalnızca mobil uygulamanın üst kısmında yer alacak bir **story bar** deneyimini uçtan uca sağlayan, bakımı kolay ve kontrollü şekilde büyütülebilecek bir ürün çıkarmaktır.

Bu PRD, kullanıcı tarafından paylaşılan PDF beklentileri ve sonrasında tek tek netleştirilen kararlar birleştirilerek hazırlanmıştır. Bu versiyonda açık nokta bırakılmamıştır; kararsız kalan küçük teknik detaylar için maintainability-first yaklaşımı benimsenmiştir.

---

## 2. Ürün özeti

Ürün 4 ana parçadan oluşur:

1. **Web Admin Console**
   İç ekiplerin placement, story group set, story group, story ve asset yönetimini yapabildiği panel.

2. **Delivery API**
   `client_id + static token` ile yetkilendirilmiş native SDK çağrılarına, ilgili placement ve context için geçerli story feed’ini dönen API katmanı.

3. **Native iOS SDK**
   Feed’i çeken, local DB ve media cache yöneten, story bar ve fullscreen viewer render eden native iOS kütüphanesi.

4. **Native Android SDK**
   Feed’i çeken, local DB ve media cache yöneten, story bar ve fullscreen viewer render eden native Android kütüphanesi.

---

## 3. Ürün hedefi

### 3.1 Ana hedef

İçerik ekiplerinin geliştiriciye ihtiyaç duymadan story içeriklerini yönetebildiği; mobil ekiplerin ise yalnızca `client_id + token` ile, placement bazlı bir story bar’ı kolayca uygulamalarına entegre edebildiği bir platform kurmak.

### 3.2 Başarı tanımı

Aşağıdakiler sorunsuz çalışıyorsa v1 başarılı kabul edilir:

- Admin panelden placement, set, group ve story tanımlanabilir.
- Story Group Set, Story Group ve Story seviyesinde draft/published akışı kontrollü şekilde yönetilir.
- SDK cache varsa bar’ı hızlıca gösterir, arka planda refresh yapar.
- Fullscreen viewer image ve video story’leri oynatır.
- CTA host app’e callback ile iletilir; SDK navigasyon yapmaz.
- `viewed` state yalnızca local device’ta tutulur ve revision bazlı doğru davranır.
- Targeting kuralları deterministic biçimde çözülür.

---

## 4. V1 kapsamı

## 4.1 In scope

### Server side
- Single-tenant web admin console
- Placement yönetimi
- Tek client için `client_id` ve çoklu aktif static token yönetimi
- Story Group Set oluşturma, düzenleme, listeleme, draft kaydetme, publish/unpublish, hard delete
- Story Group oluşturma, düzenleme, kopyalama, listeleme, archive/restore, publish/unpublish
- Story oluşturma, düzenleme, listeleme, draft kaydetme, archive/restore, publish/unpublish, taşıma, hard delete
- Upload-first asset yönetimi
- Feed çözümleme ve dağıtım API’si
- API güvenliği
- Basit preview
- Opsiyonel event ingestion altyapısı (feature-flag ile)

### Client side
- Ayrı native iOS SDK
- Ayrı native Android SDK
- Story bar render
- Fullscreen viewer
- Image + video story desteği
- CTA callback
- Local DB + local media cache
- Viewed state yönetimi
- Optional analytics callback’leri

## 4.2 Out of scope

- Storyly benzeri generic placement engine
- Banner, swipe card, canvas, survey, quiz, countdown vb. widget ailesi
- Interactive story bileşenleri
- Web SDK
- React Native SDK
- Geniş theming/customization engine
- Admin tarafında analytics dashboard
- Server-side user-level viewed sync
- Scheduling / zaman bazlı publish
- Approval workflow / çok rollü yayın onayı
- Multi-language content
- Video transcoding pipeline
- Signed asset URL ya da media proxy

---

## 5. Temel karar özeti

Bu bölüm, sonradan netleştirilen kritik kararları özetler.

- Ürün **single-tenant** olacak.
- Admin console **çoklu kullanıcı ama tek rol** modeliyle çalışacak.
- Admin auth modeli **email + password** olacak.
- İlk kullanıcı **seed admin** olarak gelir; sonraki kullanıcılar admin tarafından oluşturulur.
- Yeni kullanıcıya **geçici şifre** verilir; **ilk girişte şifre değişikliği zorunludur**.
- Şifre unutma/reset akışı **başka bir admin** tarafından yürütülür.
- Sistem **tek client modeli** ile çalışır.
- Güvenlik için **birden fazla aktif static token** desteklenir; token üretme ve revoke akışı vardır.
- `401/403` durumunda SDK **cache’i göstermemelidir**.
- Placement modeli kullanılacaktır; `placement_key` render çağrısında dinamik verilecektir.
- Targeting **set seviyesinde** yapılacaktır.
- Targeting boyutları: `platform`, `min_app_version`, `user_segments[]`.
- Story Group birden fazla set içinde **paylaşımlı referans** olarak yeniden kullanılabilir.
- Story birden fazla group içinde kullanılamaz; **tek parent** modelindedir.
- Story Group copy işlemi **deep copy**’dir.
- V1’de **image + video** story desteklenir.
- Video story için **zorunlu poster/cover image** vardır.
- CTA hem **URL** hem **deeplink** destekler; SDK yönlendirme yapmaz, yalnızca **callback** döner.
- Viewed state yalnızca **local device**’ta tutulur.
- Viewed state **revision bazlı** davranır; yeni publish edilen revision tekrar unviewed sayılır.
- Story content değişikliği **story publish** ile canlıya yansır.
- Group composition değişikliği **group republish** gerektirir.
- Set composition/config değişikliği **set republish** gerektirir.
- SDK **cache-first render + background refresh** mantığıyla çalışır.
- Cache **context-scoped**, viewed state ise **global content state** mantığında tutulur.
- Medya URL’leri **public URL** olacaktır.
- SDK UI **sabit** olacaktır.

---

## 6. Sistem bileşenleri

## 6.1 Admin Console

Shadcn/ui tabanlı web uygulamasıdır. İçerik ekipleri için ana operasyon yüzeyidir.

Temel ekranlar:
- Login / change password
- Placements
- Client & static tokens
- Story Group Sets
- Story Groups
- Stories
- Users
- Preview

## 6.2 Delivery API

SDK’dan gelen `client_id + token + placement + context` bilgisine göre hangi published set’in döneceğini belirler ve full snapshot feed döner.

## 6.3 Native SDK’lar

Her iki SDK da aşağıdaki ortak davranışı sağlayacaktır:
- init
- user context set etme
- placement bazlı render
- fullscreen viewer
- local metadata cache
- local media cache
- analytics callbacks
- CTA callback

---

## 7. Domain modeli

## 7.1 Ana entity’ler

### Client
Single-tenant yapıda tek bir client bulunur.

Önerilen alanlar:
- `id`
- `name`
- `client_id` (public)
- `status` (`active` | `inactive`)
- `created_at`
- `updated_at`

### StaticToken
Tek client için birden fazla aktif token olabilir.

Önerilen alanlar:
- `id`
- `client_id`
- `name`
- `token_hash`
- `status` (`active` | `revoked`)
- `last_used_at`
- `created_at`
- `revoked_at`

Notlar:
- Token plain hali sadece oluşturulduğu anda gösterilir.
- DB’de yalnızca hash tutulur.

### Placement
SDK tarafında render edilen story bar yerleşimini temsil eder.

Alanlar:
- `id`
- `name` (zorunlu)
- `key` (zorunlu, unique)
- `description` (opsiyonel)
- `created_at`
- `updated_at`

### StoryGroupSet
Placement’e bağlanan ve targeting kuralları taşıyan üst kapsayıcıdır.

Root alanlar:
- `id`
- `status` (`draft` | `published` | `unpublished`)
- `current_draft_revision_id`
- `current_published_revision_id`
- `created_at`
- `updated_at`

Revision alanları:
- `name`
- `placement_id`
- `min_story_group_count`
- `max_story_group_count`
- `is_fallback`
- `platform_targets[]`
  - `platform` = `ios | android`
  - `min_app_version`
- `user_segments[]` (opsiyonel)

Kurallar:
- `min_story_group_count <= max_story_group_count`
- `min/max` yalnızca **publish validation** içindir
- Bir placement için en fazla **1 adet published fallback set** olabilir
- Fallback set’te targeting alanları boş olmalıdır
- Aynı çözümleme sonucunu üretecek iki published set publish edilemez

### StoryGroup
Story bar içindeki kliklenebilir giriş noktasıdır.

Root alanlar:
- `id`
- `status` (`draft` | `published` | `unpublished` | `archived`)
- `current_draft_revision_id`
- `current_published_revision_id`
- `archived_at`
- `created_at`
- `updated_at`

Revision alanları:
- `name` (zorunlu)
- `logo_asset_id` (zorunlu, kare)
- `badge_icon_type` (`emoji` | `svg` | `none`)
- `badge_icon_value`
- `bottom_label`

Kurallar:
- Bir group birden fazla set içinde referans olarak kullanılabilir
- Group copy işlemi **deep copy**’dir; yeni group ve içindeki story’ler yeni root kayıtlar olarak yaratılır
- Group için hard delete yoktur; sadece archive/restore vardır

### Story
Tek bir Story Group’a bağlı olan fullscreen içeriktir.

Root alanlar:
- `id`
- `story_group_id`
- `status` (`draft` | `published` | `unpublished` | `archived`)
- `current_draft_revision_id`
- `current_published_revision_id`
- `archived_at`
- `created_at`
- `updated_at`

Revision alanları:
- `media_type` (`image` | `video`)
- `image_asset_id` (image story için)
- `video_asset_id` (video story için)
- `video_poster_asset_id` (video story için zorunlu)
- `cta_label` (opsiyonel)
- `cta_target_type` (`url` | `deeplink`)
- `cta_target_value`
- `image_duration_seconds` (opsiyonel override)

Kurallar:
- Story yalnızca **tek parent group**’a bağlıdır
- CTA tamamen opsiyoneldir
- CTA varsa `cta_label + target_type + target_value` birlikte zorunludur
- Story archive edilebilir ve restore edilebilir
- Story hard delete yalnızca güvenli koşullarda yapılabilir; publish edilmiş veya aktif referans taşıyan içerik için delete yerine archive tercih edilir

### Asset
Upload edilen dosya kaydıdır.

Alanlar:
- `id`
- `kind` (`group_logo` | `group_badge_svg` | `story_image` | `story_video` | `story_video_poster`)
- `mime_type`
- `width`
- `height`
- `duration_ms` (video için)
- `bytes`
- `storage_key`
- `public_url`
- `created_at`

### AdminUser
Alanlar:
- `id`
- `email`
- `password_hash`
- `must_change_password`
- `status` (`active` | `disabled`)
- `created_at`
- `updated_at`

Not:
- V1’de çoklu kullanıcı vardır, fakat rol ayrımı yoktur

---

## 8. Revision ve publish modeli

## 8.1 Genel ilke

StoryGroupSet, StoryGroup ve Story için **working draft + published version** modeli kullanılacaktır.

Önerilen yaklaşım:
- Her root entity sabit bir kimliğe sahiptir
- Her root entity’nin bir draft revision’ı ve opsiyonel published revision’ı vardır
- Edit işlemleri draft revision üzerinde yapılır
- Publish işlemi draft’ı yeni published revision haline getirir

Bu modelin amacı, canlı içerik ile edit edilen içeriği birbirinden ayırmaktır.

## 8.2 Anında canlıya yansıyan değişiklikler

### Story content publish
Aşağıdaki değişiklikler **Story publish** ile anında canlıya yansır:
- image değişikliği
- video değişikliği
- poster değişikliği
- CTA değişikliği
- image duration override değişikliği

Bu davranış, story’nin bağlı olduğu group published ise geçerlidir.

## 8.3 Republish gerektiren değişiklikler

### Group republish gerektirenler
Aşağıdaki değişiklikler **group composition** sayılır ve yalnızca **Group republish** ile canlıya yansır:
- group içine yeni story ekleme
- group içinden story çıkarma
- story’yi başka group’a taşıma
- group içi story sırası değiştirme

### Set republish gerektirenler
Aşağıdaki değişiklikler **set composition/config** sayılır ve yalnızca **Set republish** ile canlıya yansır:
- sete group ekleme / çıkarma
- set içi group sırası değiştirme
- placement değiştirme
- targeting değiştirme
- fallback flag değiştirme

## 8.4 Paylaşımlı group davranışı

Bir Story Group birden fazla set içinde kullanılıyorsa:
- group publish edildiği anda
- onu kullanan tüm published set’lerde
- yeni published group revision’ı anında canlıya yansır

## 8.5 Filtreleme modeli

Parent publish edilmiş olsa bile child publish edilmemiş olabilir.

Runtime’da şu kurallar uygulanır:
- unpublished story feed’e dahil edilmez
- archived story feed’e dahil edilmez
- unpublished group feed’e dahil edilmez
- archived group feed’e dahil edilmez
- child filtreleme sonrası boş kalan group feed’den çıkarılır
- set filtreleme sonrası boş kalırsa önce fallback set denenir
- fallback set de yoksa `200 + empty feed` dönülür

Notlar:
- `min/max story group count` yalnızca publish-time validation’dır
- runtime’da filtreleme sonrası `min` altına düşülse bile kalan renderable group’lar gösterilir

---

## 9. Admin Console gereksinimleri

Admin console **shadcn/ui** ile geliştirilecektir.

## 9.1 Authentication ve kullanıcı yönetimi

### Login
- Email + password ile giriş yapılır

### Kullanıcı oluşturma
- İlk admin seed olarak gelir
- Yeni kullanıcıları mevcut admin oluşturur
- Oluşturma sırasında kullanıcıya geçici şifre atanır
- İlk girişte şifre değişikliği zorunludur

### Şifre reset
- Self-service mail reset akışı yoktur
- Başka bir admin geçici şifre reseti yapar

### Yetki modeli
- V1’de rol ayrımı yoktur
- Tüm kullanıcılar aynı operasyonel yetkiye sahiptir

## 9.2 Placement yönetimi

Desteklenen işlemler:
- create
- edit
- list

Alanlar:
- `name`
- `key`
- `description`

Kurallar:
- `key` unique olmalıdır
- SDK yalnızca `placement_key` ile çalışır

## 9.3 Client ve token yönetimi

Desteklenen işlemler:
- tek client görüntüleme/düzenleme
- static token üretme
- static token listeleme
- static token revoke etme

Kurallar:
- birden fazla token aynı anda active olabilir
- revoke edilen token ile yeni request yetkisiz sayılır
- token hash’li saklanır

## 9.4 Story Group Set yönetimi

Desteklenen işlemler:
- oluşturma
- düzenleme
- draft kaydetme
- listeleme
- publish
- unpublish
- delete
- sete group ekleme
- setten group çıkarma
- sıralama değiştirme

Alanlar:
- `name`
- `placement_id`
- `min_story_group_count`
- `max_story_group_count`
- `is_fallback`
- `platform_targets[]`
- `user_segments[]`

Kurallar:
- fallback set ise targeting alanları boş olmalıdır
- publish validation sırasında hedefleme çakışmaları engellenmelidir
- group sırası manuel yönetilir
- set delete için set unpublished olmalıdır

## 9.5 Story Group yönetimi

Desteklenen işlemler:
- oluşturma
- düzenleme
- kopyalama
- listeleme
- archive
- restore
- publish
- unpublish

Alanlar:
- `name`
- `logo`
- `badge icon` (emoji veya svg)
- `bottom_label`

Kurallar:
- logo kare olmak zorundadır
- badge icon giriliyorsa yalnızca emoji veya svg olabilir
- aynı group birden fazla set içinde paylaşımlı referans olabilir
- hard delete yoktur

## 9.6 Story yönetimi

Desteklenen işlemler:
- oluşturma
- düzenleme
- listeleme
- draft kaydetme
- publish
- unpublish
- archive
- restore
- move to another group
- delete
- manuel sıralama

Alanlar:
- `media_type`
- `image` veya `video`
- `video_poster`
- `cta_label`
- `cta_target_type`
- `cta_target_value`
- `image_duration_seconds`

Kurallar:
- image ve video birlikte zorunlu değildir; `media_type` neyse ona uygun alan dolu olmalıdır
- video için poster zorunludur
- CTA tamamen opsiyoneldir
- CTA varsa tüm alanlar birlikte zorunludur
- hard delete, yalnızca güvenli koşullarda ve aktif/published referans bozmuyorsa yapılabilir
- başka yapılar tarafından aktif referanslanan entity delete edilemez

## 9.7 Basit preview

Admin panelde basit preview bulunacaktır.

Beklenen yetenekler:
- placement seçerek önizleme açma
- group sırası ve story sırası görme
- CTA var/yok durumunu görme
- image/video ayrımını görme
- targeting context simülasyonu yapmadan temel akışı test etme

Not:
- Preview, native SDK ile bire bir piksel-perfect olmak zorunda değildir
- Ama contract, sıra ve içerik görünürlüğü açısından güvenilir olmalıdır

---

## 10. Delivery API gereksinimleri

## 10.1 SDK feed endpoint

V1 için önerilen endpoint:

`POST /v1/sdk/feed`

### Request body

```json
{
  "client_id": "public-client-id",
  "placement_key": "home_top_story_bar",
  "platform": "ios",
  "app_version": "5.2.1",
  "user_segments": ["vip", "beta"]
}
```

### Headers

```http
Authorization: Bearer <static-token>
```

### Response yaklaşımı

API full snapshot döner.

Örnek response shape:

```json
{
  "placement": {
    "key": "home_top_story_bar",
    "name": "Home Top Story Bar"
  },
  "resolved_set": {
    "id": "sgs_123",
    "revision_id": "sgsr_456",
    "name": "Homepage VIP Set",
    "resolution_type": "matched"
  },
  "story_groups": [
    {
      "id": "sg_1",
      "revision_id": "sgr_11",
      "name": "Campaign A",
      "logo_url": "https://cdn.example.com/...",
      "badge": {
        "type": "emoji",
        "value": "🔥"
      },
      "bottom_label": "Fırsat",
      "stories": [
        {
          "id": "st_1",
          "revision_id": "str_101",
          "media_type": "image",
          "image_url": "https://cdn.example.com/...",
          "duration_seconds": 5,
          "cta": {
            "label": "İncele",
            "target_type": "deeplink",
            "target_value": "app://campaign/123"
          }
        }
      ]
    }
  ]
}
```

## 10.2 Güvenlik

Kurallar:
- `client_id` aktif olmalıdır
- Bearer token valid ve active olmalıdır
- token ilgili client’a ait olmalıdır
- yetkisiz çağrılar `401/403` döner

## 10.3 Set çözümleme algoritması

Feed çözümleme deterministik olmalıdır.

### Adım 1 — Placement filtreleme
İlgili `placement_key` için published set’ler bulunur.

### Adım 2 — Fallback dışı adaylar
`is_fallback = false` set’ler içinden, aşağıdaki koşulları sağlayanlar aday olur:
- request platform, set’in platform target listesinde vardır
- request `app_version >= min_app_version(platform)` koşulunu sağlar
- request segmentleri ile set segmentleri eşleşir

Segment kuralı:
- set segmentleri boşsa set segment bağımsız kabul edilir
- set segmentleri doluysa request segmentleri ile **OR** mantığında en az bir eşleşme aranır
- request segmentleri hiç yoksa yalnızca segmentsiz set’ler eşleşebilir

### Adım 3 — Önceliklendirme
Birden fazla aday varsa sıralama şu şekildedir:

1. **Platform spesifikliği**
   Daha dar platform hedefi daha önceliklidir.
   Örnek: `[ios]`, `[ios, android]`’den daha spesifiktir.

2. **App version önceliği**
   Uyumlu `min_app_version` değerleri içinde en yüksek version daha önceliklidir.

3. **Segment spesifikliği**
   Segment bazlı eşleşme, segmentsiz/default eşleşmeden daha önceliklidir.
   Gerekirse daha dar segment listesi daha spesifik kabul edilir.

### Adım 4 — Çakışma önleme
Normal koşullarda publish validation, aynı request’e birden fazla set’in eşit derecede match olmasını engellemelidir.

### Adım 5 — Fallback
Hiç uygun normal set yoksa placement için tanımlı published fallback set döner.

### Adım 6 — Empty feed
Fallback de yoksa `200 + empty feed` döner.

## 10.4 App version kıyaslama kuralı

- Format: `major.minor.patch`
- Eksik parça varsa `0` kabul edilir
  - `5.2` = `5.2.0`
- Karşılaştırma numeric yapılır
  - `5.10.0 > 5.2.0`
- Pre-release / build metadata v1’de desteklenmez

## 10.5 Publish validation kuralları

En az şu validation’lar olmalıdır:
- `min_story_group_count <= max_story_group_count`
- fallback set tekil olmalıdır
- aynı placement altında aynı çözümleme sonucunu üreten set’ler birlikte published olamaz
- segment overlap kaynaklı ambiguity engellenmelidir
- identical targeting kuralları engellenmelidir

---

## 11. Native SDK gereksinimleri

## 11.1 Genel entegrasyon modeli

SDK entegrasyonu basit olmalıdır.

Konsept API:
- `initialize(clientId, staticToken)`
- `setUserContext(userSegments: string[])`
- `renderStoryBar(placementKey, container, callbacks)`
- `reload(placementKey)`

Notlar:
- `platform` ve `app_version` SDK tarafından otomatik iletilir
- `user_segments` host app tarafından `setUserContext(...)` ile verilir
- context değişince host app manuel reload tetikler

## 11.2 Local persistence modeli

SDK iki ayrı local persistence alanı tutacaktır:

### A. Feed cache
Context-scoped tutulur.

Önerilen cache anahtarı:
- `placement_key`
- `platform`
- `app_version`
- normalized `user_segments` hash

Bu cache içinde şunlar saklanır:
- set snapshot
- group listesi
- story listesi
- ordering
- media metadata

### B. Viewed state store
Global content state mantığında tutulur.

Kurallar:
- aynı story revision başka placement’ta görünse de viewed sayılır
- aynı group başka placement’ta görünse de, child story revision’larına göre viewed kabul edilir
- viewed state context-scoped değildir

## 11.3 Refresh ve cache davranışı

Kurallar:
- SDK her açılışta refresh denemelidir
- cache varsa **önce cache render edilir**
- sonra **background refresh** yapılır
- refresh başarılıysa local DB ve UI güncellenir
- network/5xx hatasında son geçerli cache kullanılabilir
- cache fallback süresi sonsuzdur; yeni başarılı refresh gelene kadar kullanılabilir
- `401/403` hatasında güvenlik önceliklidir; cache gösterilmez

## 11.4 Media cache

SDK yalnızca metadata değil, medya dosyalarını da cache’leyecektir.

Kurallar:
- image ve video dosyaları local file cache’e alınır
- video poster’ları da cache’lenir
- medya cache’i feed revision değiştiğinde gerektiği kadar güncellenir
- immutable asset URL / versioned storage key yaklaşımı tercih edilmelidir

## 11.5 Story bar davranışı

Kurallar:
- story bar sırası API’den geldiği gibi manuel sırayı korur
- viewed group’lar bar’da kalır; yalnızca görsel state ile ayrışır
- UI fixed’tir; host app görsel theme override veremez
- group’a tap edilince viewer açılır
- bir group ilk açıldığında:
  - ilk unviewed story’den başlar
  - tüm story’ler viewed ise ilk story’den başlar

## 11.6 Viewer davranışı

### Medya oynatma
- image story default 5 saniye gösterilir
- image story için story-level override mümkündür
- video story süresi videonun doğal süresidir
- video sessiz autoplay başlar
- kullanıcı isterse unmute edebilir

### Story transition
- aynı group içindeki story geçişi animasyonsuz hızlı hide/show ile olur
- auto-play ile sonraki story’ye geçilir
- kullanıcı sol/sağ tap alanları ile story değiştirir

### Group transition
- kullanıcı swipe ile önceki/sonraki group’a geçebilir
- group geçişlerinde **cube efekti** kullanılır
- group sonundaki auto-advance de sonraki group’a cube efektiyle geçer

### Boundary davranışı
- ilk story’de sola tap → önceki group
- son story’de sağa tap → sonraki group

### Group açılış kuralı
- ileri geçişte hedef group:
  - ilk unviewed story’den
  - hepsi viewed ise ilk story’den açılır
- geri geçişte hedef group son story’den açılır

### Viewer kapanışı
- close button ile kapanabilir
- swipe down ile kapanabilir
- placement içindeki son group bittikten sonra viewer otomatik kapanır
- CTA tap’inde viewer kapanır ve sonra callback döner

### Pause / resume
- app background’a geçince pause
- app foreground’a dönünce resume
- long press yapınca pause
- long press bırakılınca resume

## 11.7 Viewed state kuralları

Kurallar:
- story ekrana geldiği anda `story.viewed = true`
- group içindeki tüm child story revision’ları viewed ise `group.viewed = true`
- yeni publish edilen story revision tekrar unviewed sayılır
- group republish sonrası `group.viewed`, child story revision’larına göre yeniden hesaplanır
- story-level viewed state ilgili story revision bazında korunur

## 11.8 CTA callback contract’ı

SDK CTA’ya basınca host app’e callback dönecektir.
SDK kendisi navigasyon yapmayacaktır.

Örnek payload:

```json
{
  "placement_key": "home_top_story_bar",
  "story_group_id": "sg_1",
  "story_group_revision_id": "sgr_11",
  "story_id": "st_1",
  "story_revision_id": "str_101",
  "target_type": "deeplink",
  "target_value": "app://campaign/123",
  "label": "İncele"
}
```

## 11.9 Analytics callback’leri

SDK aşağıdaki event’ler için optional callback sunacaktır:
- `story_bar_impression`
- `story_group_tap`
- `story_view`
- `story_complete`
- `story_cta_tap`
- `viewer_close`
- `group_complete`

Kurallar:
- callback’ler opsiyoneldir
- host app bu event’leri istediği analytics altyapısına forward edebilir
- event toplama server-side feature flag ile ayrıca açılabilir

---

## 12. Asset ve medya kuralları

## 12.1 Upload-first yaklaşımı

Admin panelden dosya upload edilir; sistem asset’i kendi object storage’ında saklar ve public URL üretir.

## 12.2 Format kuralları

### Group logo
- zorunlu
- kare olmalı

### Badge
- emoji veya svg

### Story image
- `jpg`, `png`, `webp`
- zorunlu aspect ratio: `9:16`

### Story video
- `mp4`
- codec: `H.264 + AAC`
- zorunlu aspect ratio: `9:16`
- maksimum süre: `30 saniye`
- maksimum boyut: `50 MB`

### Video poster
- `jpg`, `png`, `webp`
- zorunlu

## 12.3 Video pipeline

V1’de video tarafında transcoding yapılmayacaktır.

Sistem yalnızca:
- upload validation
- metadata extraction
- depolama
- public URL üretme

yapar.

---

## 13. Security gereksinimleri

## 13.1 Feed API güvenliği

- Feed yalnızca valid `client_id + token` ile çağrılabilir
- inactive client request yapamaz
- revoked token request yapamaz
- unauthorized durumda `401/403` döner

## 13.2 Asset erişimi

- asset URL’leri public olacaktır
- asset upload ise admin auth ile korunacaktır

## 13.3 Admin güvenliği

- password hash’li tutulur
- session/auth state güvenli şekilde saklanır
- temp password ilk girişte değiştirilir
- reset işlemi yalnızca admin üzerinden yapılır

---

## 14. Analytics yaklaşımı

## 14.1 SDK tarafı

SDK callback-first analytics yaklaşımıyla çalışır.

Yani:
- SDK event üretir
- host app isterse Firebase, Adjust, Segment, kendi BI sistemi vb. yerlere forward eder

## 14.2 Server tarafı

- Event ingestion altyapısı feature flag ile açılıp kapatılabilir
- V1’de admin panelde analytics dashboard olmayacaktır
- Event ingestion açılırsa v1’de amaç raw event toplamak olmalıdır; raporlama UI bu kapsamda değildir

---

## 15. Önerilen tech stack

Amaç: kolay maintain edilebilen, tek elde kontrol edilebilen, ama gerektiğinde ölçeklenebilen bir yapı.

## 15.1 Repo yaklaşımı

- `pnpm workspaces`
- `Turborepo`
- modular monolith yaklaşımı

Önerilen yapı:

```text
/
  apps/
    admin-web/
    api/
  packages/
    contracts/
    db/
    config/
    ui/
  sdk/
    android/
    ios/
  docs/
    prd/
    adr/
```

## 15.2 Admin web

- Next.js
- TypeScript
- shadcn/ui
- Tailwind CSS
- TanStack Query
- React Hook Form
- Zod

## 15.3 Backend API

- NestJS
- Fastify
- Prisma
- PostgreSQL
- S3-compatible object storage

Not:
- V1 için ayrı microservice mimarisine gerek yoktur
- Worker/scheduler zorunlu değildir; scheduling zaten kapsam dışıdır

## 15.4 Android SDK

- Kotlin
- Android View tabanlı fixed UI
- Room
- OkHttp
- Kotlinx Serialization
- Coil
- Media3 / ExoPlayer

## 15.5 iOS SDK

- Swift
- UIKit tabanlı fixed UI
- URLSession
- Codable
- GRDB veya benzeri hafif SQLite katmanı
- AVFoundation / AVKit

---

## 16. Kabul kriterleri

Aşağıdaki senaryolar çalışıyorsa v1 kabul edilebilir.

### Admin
- Placement oluşturulabiliyor
- Set draft olarak kaydedilip publish edilebiliyor
- Group oluşturulup sete eklenebiliyor
- Story image/video eklenebiliyor
- Group copy deep copy olarak çalışıyor
- Group archive/restore çalışıyor
- Story move farklı group’a alınabiliyor
- Token üretme ve revoke çalışıyor
- Basit preview çalışıyor

### API
- Doğru placement ve context için doğru set çözülüyor
- Hedefleme çakışmaları publish anında engelleniyor
- Fallback doğru çalışıyor
- Child filtreleme doğru çalışıyor
- Empty feed senaryosu doğru dönüyor

### SDK
- Cache varsa bar hızlıca açılıyor
- Background refresh sonrası feed güncelleniyor
- Unauthorized durumda cache gösterilmiyor
- Image/video story viewer doğru çalışıyor
- Sol/sağ tap ile story geçişi çalışıyor
- Swipe ile group geçişi çalışıyor
- Cube transition çalışıyor
- CTA callback payload’ı doğru geliyor
- Viewed state revision bazlı doğru çalışıyor
- Global content viewed state placement’lar arasında doğru davranıyor

---

## 17. Implementation notları

Codex için önerilen geliştirme sırası:

1. Monorepo scaffold
2. Shared contracts + DB schema
3. Admin auth + user management
4. Placement + client + token yönetimi
5. Asset upload
6. Story Group Set / Story Group / Story draft-revision modeli
7. Publish validation kuralları
8. Feed resolution API
9. Android SDK metadata cache + story bar + viewer
10. iOS SDK metadata cache + story bar + viewer
11. Basit preview
12. Optional event ingestion flag altyapısı

Önce contract ve revision modelini sabitlemek, animasyon/polish işlerinden daha önemlidir.

---

## 18. Son karar

Bu ürünün başarısı, Storyly’nin geniş feature setini taklit etmekte değil; aşağıdaki çekirdeği kusursuz ve sade biçimde sunmakta yatmaktadır:

- güvenli feed dağıtımı
- net content lifecycle
- deterministic targeting
- hızlı native render
- doğru local viewed state
- bakım maliyeti düşük bir operasyon paneli

Bu PRD’ye göre geliştirilen v1, daha sonra analytics UI, web/RN SDK, richer theming veya gelişmiş targeting gibi katmanlarla büyümeye uygun bir temel oluşturacaktır.
