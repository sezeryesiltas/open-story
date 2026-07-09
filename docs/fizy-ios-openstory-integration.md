# Fizy iOS OpenStory Entegrasyonu

Bu doküman, OpenStory iOS SDK'sını Fizy iOS uygulamasına en az geliştirici
eforuyla eklemek için hazırlanmıştır. Akış hedeflemesizdir; Fizy boş segment
gönderir ve OpenStory ilgili placement için yayınlanmış fallback story bar'ı
döner.

## Entegrasyon Değerleri

| Alan | Değer |
| --- | --- |
| API base URL | `https://api.openstory.cloud` |
| Client ID | `public-client-id` |
| Static token | Ayrı iletilecek. Kaynak koda commit edilmemeli. |
| User segments | `[]` |
| Placement key | OpenStory admin'de Fizy için tanımlanan placement. Örnek: `fizy_home_story_bar`. |

Fallback içerik placement bazında çözülür. Backend'de farklı bir placement key
tanımlandıysa aşağıdaki örneklerde sadece `placementKey` sabitini değiştirin.

## SDK'yı İndirme

Public repo:

```text
https://github.com/sezeryesiltas/open-story
```

iOS SDK Swift Package olarak şu klasördedir:

```text
sdk/ios
```

Package manifest repo kökünde değil `sdk/ios` altında olduğu için Xcode'a
GitHub repo kökünü remote Swift Package olarak eklemeyin. En az eforlu akış:

1. Repoyu Fizy uygulama reposunun yanına veya `Vendor` altına indirin.
2. Xcode'da `sdk/ios` klasörünü local Swift Package olarak ekleyin.
3. Fizy app target'ına `OpenStorySDK` product'ını linkleyin.

Örnek local checkout:

```bash
mkdir -p Vendor
git clone https://github.com/sezeryesiltas/open-story.git Vendor/open-story
```

CI build'leri için bu checkout'u erişilebilir hale getirin. En basit seçenekler:
git submodule, CI'da checkout step'i veya Fizy reposunda versiyonlanan vendor
klasörü.

Xcode:

```text
File > Add Package Dependencies... > Add Local...
```

Seçilecek klasör:

```text
Vendor/open-story/sdk/ios
```

Fizy projesi `Package.swift` kullanıyorsa:

```swift
.package(path: "Vendor/open-story/sdk/ios")
```

Ardından app target dependency listesine `OpenStorySDK` ekleyin.

## Gereksinimler

- iOS deployment target: `15.0` veya üstü
- Xcode: `16.2` veya üstü
- Swift: `6` uyumlu toolchain
- UIKit host screen
- Ek CocoaPods gerekmiyor

SDK feed isteğini içeride şu endpoint'e atar:

```text
POST https://api.openstory.cloud/v1/sdk/feed
```

`baseURL` olarak sadece API origin verin. `/v1` veya `/v1/sdk/feed`
eklemeyin.

Doğru:

```swift
baseURL: "https://api.openstory.cloud"
```

Yanlış:

```swift
baseURL: "https://api.openstory.cloud/v1"
```

## App Config

Fizy tarafında küçük bir config wrapper oluşturun. Static token'ı uygulamanın
mevcut secret/config akışından okuyun; kaynak koda açık token yazmayın.

```swift
import Foundation

enum FizyOpenStoryConfig {
    static let baseURL = "https://api.openstory.cloud"
    static let clientId = "public-client-id"
    static let placementKey = "fizy_home_story_bar"

    static var staticToken: String {
        // Fizy'nin secure config, CI-injected xcconfig veya commit edilmeyen
        // başka bir runtime config kaynağından okuyun.
        "<OPEN_STORY_STATIC_TOKEN>"
    }
}
```

## SDK'yı Bir Kez Başlatma

SDK `@MainActor` çalışır. Bootstrap'i main thread üzerinde bir kez çağırın.
Ekran tekrar oluşursa SDK'nın tekrar tekrar initialize edilmemesi için wrapper
idempotent tutulmalıdır.

```swift
import OpenStorySDK

@MainActor
enum FizyOpenStoryBootstrap {
    private static var didConfigure = false

    static func configureOnce() {
        guard !didConfigure else { return }
        didConfigure = true

        OpenStory.initialize(
            configuration: OpenStoryConfiguration(
                clientId: FizyOpenStoryConfig.clientId,
                staticToken: FizyOpenStoryConfig.staticToken,
                baseURL: FizyOpenStoryConfig.baseURL
            )
        )

        // Bu entegrasyonda hedefleme yok.
        OpenStory.setUserContext([String]())
    }
}
```

Çağırmak için uygun yerler:

- app bootstrap akışı
- `SceneDelegate`
- story bar gösterebilen ilk ekran

Render çağrısından önce `configureOnce()` çalışmış olmalı.

## Story Bar Render

Story bar'ın görüneceği yere bir `UIView` ekleyin. Önerilen yükseklik `106`.

```swift
import OpenStorySDK
import UIKit

@MainActor
final class FizyHomeViewController: UIViewController, OpenStoryCallbacks {
    private let storyBarContainer = UIView()

    override func viewDidLoad() {
        super.viewDidLoad()

        FizyOpenStoryBootstrap.configureOnce()
        addStoryBarContainer()

        OpenStory.renderStoryBar(
            placementKey: FizyOpenStoryConfig.placementKey,
            in: storyBarContainer,
            callbacks: self
        )
    }

    private func addStoryBarContainer() {
        storyBarContainer.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(storyBarContainer)

        NSLayoutConstraint.activate([
            storyBarContainer.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            storyBarContainer.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            storyBarContainer.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            storyBarContainer.heightAnchor.constraint(equalToConstant: 106)
        ])
    }

    func onStoryCtaTap(payload: OpenStoryCtaPayload) {
        switch payload.targetType {
        case .url:
            // URL'i Fizy içinde açın veya route edin.
            break
        case .deeplink:
            // Deeplink'i Fizy router'ına iletin.
            break
        }
    }

    func onError(placementKey: String, error: Error) {
        // Opsiyonel: Fizy logging/observability sistemine iletin.
    }
}
```

SDK, kullanıcı story group'a dokunduğunda kendi fullscreen viewer'ını açar. CTA
tap edildiğinde viewer kapanır ve `onStoryCtaTap` callback'i gelir. SDK kendi
başına navigation yapmaz; URL/deeplink routing Fizy tarafında yapılır.

## Reload

Login, logout, foreground veya manuel yenileme sonrası bar'ı tazelemek için:

```swift
OpenStory.reload(placementKey: FizyOpenStoryConfig.placementKey)
```

Bu fallback-only kurulumda segment göndermeyin:

```swift
OpenStory.setUserContext([String]())
```

İleride Fizy hedefleme isterse segmentler ayrıca planlanmalı ve host app
context değişiminden sonra `reload` çağırmalıdır.

## Opsiyonel Analytics Callback'leri

Sadece Fizy'nin ihtiyaç duyduğu callback'leri implement edin.
`OpenStoryCallbacks` default boş implementation sağladığı için hepsi
opsiyoneldir.

```swift
func onStoryBarImpression(event: OpenStoryAnalyticsEvent) {}
func onStoryGroupTap(event: OpenStoryAnalyticsEvent) {}
func onStoryView(event: OpenStoryAnalyticsEvent) {}
func onStoryComplete(event: OpenStoryAnalyticsEvent) {}
func onViewerClose(event: OpenStoryAnalyticsEvent) {}
func onGroupComplete(event: OpenStoryAnalyticsEvent) {}
```

Event alanları:

- `placementKey`
- `storyGroupId`
- `storyGroupRevisionId`
- `storyId`
- `storyRevisionId`
- `occurredAtMillis`

CTA payload alanları:

- `placementKey`
- `storyGroupId`
- `storyGroupRevisionId`
- `storyId`
- `storyRevisionId`
- `label`
- `targetType`
- `targetValue`

## Feed Smoke Test

Uygulama UI'ını debug etmeden önce backend/token/placement kombinasyonunu test
edin:

```bash
curl -X POST "https://api.openstory.cloud/v1/sdk/feed" \
  -H "Authorization: Bearer <OPEN_STORY_STATIC_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "public-client-id",
    "placement_key": "fizy_home_story_bar",
    "platform": "ios",
    "app_version": "1.0.0",
    "user_segments": []
  }'
```

Beklenen sonuç:

- `200` response
- fallback içerik dönüyorsa `resolved_set.is_fallback` değeri `true`
- görünür story bar için `resolved_set.groups` içinde en az bir group

## Sık Karşılaşılan Sorunlar

| Belirti | Kontrol |
| --- | --- |
| Xcode package'ı bulamıyor | Repo kökünü değil `sdk/ios` klasörünü local package olarak ekleyin. |
| Build deployment target yüzünden fail oluyor | Fizy app target'ını iOS `15.0` veya üstüne alın. |
| Story bar `200` ile boş geliyor | Placement altında published fallback set, published group ve published story olduğundan emin olun. |
| `401` veya `403` | Static token eksik, hatalı, inactive veya revoked olabilir. SDK auth hatasında cache render etmez. |
| CTA tap navigation yapmıyor | Beklenen davranış bu. `onStoryCtaTap` içinde Fizy routing yapılmalı. |
| Yanlış endpoint'e istek gidiyor | `baseURL` sadece `https://api.openstory.cloud` olmalı. SDK `/v1/sdk/feed` ekler. |

## Agent Checklist

Fizy reposunda çalışan bir AI coding agent şu sırayla ilerlemeli:

1. `Vendor/open-story/sdk/ios` klasörünü local Swift Package olarak ekle.
2. `OpenStorySDK` product'ını iOS app target'a linkle.
3. Base URL, client ID, placement key ve commit edilmeyen static token kaynağı için config wrapper ekle.
4. Main thread üzerinde `OpenStory.initialize(...)` çağrısını tek seferlik hale getir.
5. `OpenStory.setUserContext([String]())` kullan.
6. Story bar için yüksekliği `106` olan bir `UIView` container ekle.
7. `OpenStory.renderStoryBar(placementKey:in:callbacks:)` çağır.
8. `onStoryCtaTap` içinde URL/deeplink routing'i Fizy tarafında yap.
9. Bar boşsa önce feed smoke test'i çalıştır.
