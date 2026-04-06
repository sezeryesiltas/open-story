import OpenStorySDK
import UIKit

@MainActor
final class SampleHomeViewController: UIViewController, OpenStoryCallbacks {
    private let config = SampleConfig.current()
    private let scrollView = UIScrollView()
    private let contentStack = UIStackView()
    private let storyBarHost = UIView()
    private let statusLabel = UILabel()
    private let eventLogLabel = UILabel()
    private let reloadButton = UIButton(type: .system)
    private var didRenderStoryBar = false
    private var eventLog: [String] = []

    private var heroGradientLayer: CAGradientLayer?
    private var topSurfaceGradientLayer: CAGradientLayer?

    override func viewDidLoad() {
        super.viewDidLoad()

        title = "Home"
        view.backgroundColor = Theme.background
        navigationItem.largeTitleDisplayMode = .always

        buildUI()
        configureSDKIfPossible()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()

        guard !didRenderStoryBar, config.hasStaticToken else {
            return
        }

        didRenderStoryBar = true
        OpenStory.renderStoryBar(
            placementKey: config.placementKey,
            in: storyBarHost,
            callbacks: self,
            titleColor: Theme.primaryText,
            viewedTitleColor: Theme.mutedText
        )
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        guard traitCollection.hasDifferentColorAppearance(comparedTo: previousTraitCollection) else { return }
        heroGradientLayer?.colors = Theme.heroGradientColors(for: traitCollection)
        topSurfaceGradientLayer?.colors = Theme.topSurfaceGradientColors(for: traitCollection)
    }

    func onStoryBarImpression(event: OpenStoryAnalyticsEvent) {
        updateStatus("Rendered placement \(event.placementKey) for \(config.segmentSummary).")
        appendEvent("story_bar_impression")
    }

    func onStoryGroupTap(event: OpenStoryAnalyticsEvent) {
        appendEvent("story_group_tap \(event.storyGroupRevisionId ?? "-")")
    }

    func onStoryView(event: OpenStoryAnalyticsEvent) {
        appendEvent("story_view \(event.storyRevisionId ?? "-")")
    }

    func onStoryComplete(event: OpenStoryAnalyticsEvent) {
        appendEvent("story_complete \(event.storyRevisionId ?? "-")")
    }

    func onStoryCtaTap(payload: OpenStoryCtaPayload) {
        appendEvent("story_cta_tap \(payload.targetType.rawValue) \(payload.targetValue)")
        updateStatus("CTA emitted back to host. SDK did not navigate.")
    }

    func onViewerClose(event: OpenStoryAnalyticsEvent) {
        appendEvent("viewer_close")
    }

    func onGroupComplete(event: OpenStoryAnalyticsEvent) {
        appendEvent("group_complete \(event.storyGroupRevisionId ?? "-")")
    }

    func onError(placementKey: String, error: Error) {
        updateStatus("Error on \(placementKey): \(error.localizedDescription)")
        appendEvent("error \(error.localizedDescription)")
    }

    private func buildUI() {
        view.backgroundColor = Theme.background

        storyBarHost.translatesAutoresizingMaskIntoConstraints = false
        storyBarHost.backgroundColor = .clear
        storyBarHost.heightAnchor.constraint(greaterThanOrEqualToConstant: 106).isActive = true

        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.showsVerticalScrollIndicator = false

        contentStack.translatesAutoresizingMaskIntoConstraints = false
        contentStack.axis = .vertical
        contentStack.spacing = 18
        contentStack.isLayoutMarginsRelativeArrangement = true
        contentStack.layoutMargins = UIEdgeInsets(top: 10, left: 20, bottom: 28, right: 20)

        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.font = .systemFont(ofSize: 14, weight: .semibold)
        statusLabel.textColor = Theme.statusText
        statusLabel.numberOfLines = 0

        eventLogLabel.translatesAutoresizingMaskIntoConstraints = false
        eventLogLabel.font = .monospacedSystemFont(ofSize: 12, weight: .medium)
        eventLogLabel.textColor = Theme.eventLogText
        eventLogLabel.numberOfLines = 0
        eventLogLabel.text = "waiting for callbacks..."

        reloadButton.translatesAutoresizingMaskIntoConstraints = false
        reloadButton.configuration = .filled()
        reloadButton.configuration?.title = "Reload Placement"
        reloadButton.configuration?.cornerStyle = .capsule
        reloadButton.configuration?.baseBackgroundColor = Theme.accent
        reloadButton.configuration?.baseForegroundColor = .white
        reloadButton.addTarget(self, action: #selector(handleReloadTap), for: .touchUpInside)

        let heroCard = makeHeroCard()
        let placementCard = makeDetailCard(
            title: "Placement",
            rows: [
                ("placement_key", config.placementKey),
                ("base_url", config.baseURL),
                ("segments", config.segmentSummary),
            ]
        )

        let callbackCard = makeCallbackCard()

        let topStorySurface = makeTopStorySurface()

        contentStack.addArrangedSubview(topStorySurface)
        contentStack.addArrangedSubview(heroCard)
        contentStack.addArrangedSubview(placementCard)
        contentStack.addArrangedSubview(reloadButton)
        contentStack.addArrangedSubview(callbackCard)

        view.addSubview(storyBarHost)
        view.addSubview(scrollView)
        scrollView.addSubview(contentStack)

        NSLayoutConstraint.activate([
            storyBarHost.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 4),
            storyBarHost.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 18),
            storyBarHost.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -18),

            scrollView.topAnchor.constraint(equalTo: storyBarHost.bottomAnchor, constant: 8),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            contentStack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            contentStack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            contentStack.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor),
        ])
    }

    private func configureSDKIfPossible() {
        if !config.hasStaticToken {
            reloadButton.isEnabled = false
            updateStatus("Set OPEN_STORY_STATIC_TOKEN in the scheme environment or Info.plist before rendering.")
            return
        }

        OpenStory.initialize(
            configuration: OpenStoryConfiguration(
                clientId: config.clientId,
                staticToken: config.staticToken,
                baseURL: config.baseURL
            )
        )
        OpenStory.setUserContext(config.userSegments)
        updateStatus("SDK initialized. Waiting for story bar render.")
    }

    private func makeHeroCard() -> UIView {
        let card = LayoutAwareView()
        card.translatesAutoresizingMaskIntoConstraints = false
        card.layer.cornerRadius = 30
        card.layer.cornerCurve = .continuous
        card.layer.masksToBounds = true

        let gradientLayer = CAGradientLayer()
        gradientLayer.colors = Theme.heroGradientColors(for: traitCollection)
        gradientLayer.startPoint = CGPoint(x: 0, y: 0)
        gradientLayer.endPoint = CGPoint(x: 1, y: 1)
        card.layer.insertSublayer(gradientLayer, at: 0)
        heroGradientLayer = gradientLayer

        let icon = UIImageView(image: UIImage(systemName: "sparkles.tv.fill"))
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.tintColor = Theme.heroIconTint
        icon.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 32, weight: .bold)

        let titleLabel = UILabel()
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.font = .systemFont(ofSize: 28, weight: .bold)
        titleLabel.textColor = Theme.heroTitle
        titleLabel.numberOfLines = 0
        titleLabel.text = "open-story iOS host app"

        let subtitleLabel = UILabel()
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        subtitleLabel.font = .systemFont(ofSize: 15, weight: .medium)
        subtitleLabel.textColor = Theme.heroSubtitle
        subtitleLabel.numberOfLines = 0
        subtitleLabel.text = "This host stays intentionally narrow: tab shell, placement reload, callback visibility, and fixed viewer validation."

        let stack = UIStackView(arrangedSubviews: [icon, titleLabel, subtitleLabel])
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.alignment = .leading
        stack.spacing = 16

        card.addSubview(stack)
        card.layoutIfNeeded()

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 26),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -24),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -26),
        ])

        card.heightAnchor.constraint(greaterThanOrEqualToConstant: 220).isActive = true

        card.layoutSubviewsHandler = { view in
            gradientLayer.frame = view.bounds
        }

        return card
    }

    private func makeTopStorySurface() -> UIView {
        let surface = LayoutAwareView()
        surface.translatesAutoresizingMaskIntoConstraints = false
        surface.backgroundColor = Theme.background
        surface.layer.cornerRadius = 28
        surface.layer.cornerCurve = .continuous
        surface.layer.masksToBounds = true

        let gradientLayer = CAGradientLayer()
        gradientLayer.colors = Theme.topSurfaceGradientColors(for: traitCollection)
        gradientLayer.startPoint = CGPoint(x: 0, y: 0)
        gradientLayer.endPoint = CGPoint(x: 1, y: 1)
        surface.layer.insertSublayer(gradientLayer, at: 0)
        topSurfaceGradientLayer = gradientLayer

        let titleLabel = UILabel()
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.font = .systemFont(ofSize: 20, weight: .bold)
        titleLabel.textColor = Theme.secondaryText
        titleLabel.numberOfLines = 0
        titleLabel.text = "Story bar sabit olarak üst yüzeyde durur."

        let subtitleLabel = UILabel()
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        subtitleLabel.font = .systemFont(ofSize: 14, weight: .medium)
        subtitleLabel.textColor = Theme.tertiaryText
        subtitleLabel.numberOfLines = 0
        subtitleLabel.text = "Container yerine doğrudan host yüzeyinin üstünde render edilir. Aşağıdaki içerik sadece sayfa kabuğunu simüle eder."

        let stack = UIStackView(arrangedSubviews: [titleLabel, subtitleLabel])
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 10

        surface.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: surface.topAnchor, constant: 20),
            stack.leadingAnchor.constraint(equalTo: surface.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: surface.trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(equalTo: surface.bottomAnchor, constant: -20),
        ])

        surface.layoutSubviewsHandler = { view in
            gradientLayer.frame = view.bounds
        }

        return surface
    }

    private func makeDetailCard(
        title: String,
        rows: [(String, String)]
    ) -> UIView {
        let card = CardView()

        let titleLabel = UILabel()
        titleLabel.font = .systemFont(ofSize: 20, weight: .bold)
        titleLabel.textColor = Theme.primaryText
        titleLabel.text = title

        let stack = UIStackView(arrangedSubviews: [titleLabel])
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 14

        for row in rows {
            let label = UILabel()
            label.font = .monospacedSystemFont(ofSize: 13, weight: .semibold)
            label.textColor = Theme.detailKeyText
            label.text = row.0

            let value = UILabel()
            value.font = .systemFont(ofSize: 15, weight: .medium)
            value.textColor = Theme.detailValueText
            value.numberOfLines = 0
            value.text = row.1

            let rowStack = UIStackView(arrangedSubviews: [label, value])
            rowStack.axis = .vertical
            rowStack.spacing = 4
            stack.addArrangedSubview(rowStack)
        }

        card.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 22),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -22),
        ])
        return card
    }

    private func makeCallbackCard() -> UIView {
        let card = CardView()

        let titleLabel = UILabel()
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.font = .systemFont(ofSize: 20, weight: .bold)
        titleLabel.textColor = Theme.primaryText
        titleLabel.text = "Callback stream"

        let stack = UIStackView(arrangedSubviews: [titleLabel, statusLabel, eventLogLabel])
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 12

        card.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 22),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -22),
        ])
        return card
    }

    private func updateStatus(_ text: String) {
        statusLabel.text = text
    }

    private func appendEvent(_ text: String) {
        eventLog.append(text)
        eventLog = Array(eventLog.suffix(8))
        eventLogLabel.text = eventLog.enumerated()
            .map { index, value in "\(index + 1). \(value)" }
            .joined(separator: "\n")
    }

    @objc
    private func handleReloadTap() {
        updateStatus("Reloading placement \(config.placementKey)...")
        OpenStory.reload(placementKey: config.placementKey)
    }
}

private final class CardView: UIView {
    override init(frame: CGRect) {
        super.init(frame: frame)
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = Theme.cardBackground
        layer.cornerRadius = 26
        layer.cornerCurve = .continuous
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = Theme.cardShadowOpacity(for: traitCollection)
        layer.shadowRadius = 22
        layer.shadowOffset = CGSize(width: 0, height: 10)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        nil
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        guard traitCollection.hasDifferentColorAppearance(comparedTo: previousTraitCollection) else { return }
        layer.shadowOpacity = Theme.cardShadowOpacity(for: traitCollection)
    }
}

private final class LayoutAwareView: UIView {
    var layoutSubviewsHandler: ((UIView) -> Void)?

    override func layoutSubviews() {
        super.layoutSubviews()
        layoutSubviewsHandler?(self)
    }
}
