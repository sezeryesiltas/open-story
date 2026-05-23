#if canImport(UIKit)
import ObjectiveC
import UIKit

internal final class StoryBarView: UIView {
    typealias ViewerLauncher = (
        _ anchorView: UIView,
        _ response: SdkFeedResponsePayload,
        _ initialGroupIndex: Int,
        _ group: SdkFeedGroupPayload,
        _ callbacks: (any OpenStoryCallbacks)?
    ) -> Void

    private let emptyStateLabel = InsetLabel()
    private let scrollView = StoryBarScrollView()
    private let groupRow = UIStackView()
    private weak var callbacks: (any OpenStoryCallbacks)?
    private var viewerLauncher: ViewerLauncher?
    private var impressionSentForPlacement = false
    private var lastPlacementKey: String?
    private var titleColor = UIColor(openStoryHex: "#2B1A12")
    private var viewedTitleColor = UIColor(openStoryHex: "#8E8176")

    override init(frame: CGRect) {
        super.init(frame: frame)
        buildUI()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        nil
    }

    func showLoading() {
        groupRow.arrangedSubviews.forEach { $0.removeFromSuperview() }
        scrollView.isHidden = true
        emptyStateLabel.isHidden = false
        emptyStateLabel.text = "Loading stories..."
    }

    func showEmpty(_ text: String) {
        groupRow.arrangedSubviews.forEach { $0.removeFromSuperview() }
        scrollView.isHidden = true
        emptyStateLabel.isHidden = false
        emptyStateLabel.text = text
    }

    func updateCallbacks(_ callbacks: (any OpenStoryCallbacks)?) {
        self.callbacks = callbacks
    }

    func updateViewerLauncher(_ viewerLauncher: @escaping ViewerLauncher) {
        self.viewerLauncher = viewerLauncher
    }

    func updateTitleColors(
        titleColor: UIColor,
        viewedTitleColor: UIColor
    ) {
        self.titleColor = titleColor
        self.viewedTitleColor = viewedTitleColor
    }

    func dispatchError(
        placementKey: String,
        error: Error
    ) {
        callbacks?.onError(placementKey: placementKey, error: error)
    }

    func renderSnapshot(
        response: SdkFeedResponsePayload,
        isCached: Bool,
        viewedState: ViewedStoryStateSnapshot
    ) {
        if lastPlacementKey != response.placementKey {
            impressionSentForPlacement = false
            lastPlacementKey = response.placementKey
        }

        let groups = response.resolvedSet?.groups ?? []
        guard !groups.isEmpty else {
            showEmpty("No stories available.")
            return
        }

        emptyStateLabel.isHidden = true
        scrollView.isHidden = false
        groupRow.arrangedSubviews.forEach { $0.removeFromSuperview() }

        for (index, group) in groups.enumerated() {
            let view = StoryBarGroupView()
            view.configure(
                group: group,
                isCached: isCached,
                isViewed: viewedState.isGroupViewed(group),
                titleColor: titleColor,
                viewedTitleColor: viewedTitleColor
            )
            view.onTap = { [weak self] in
                guard let self else { return }
                callbacks?.onStoryGroupTap(
                    event: OpenStoryAnalyticsEvent(
                        kind: .storyGroupTap,
                        placementKey: response.placementKey,
                        storyGroupId: group.id,
                        storyGroupRevisionId: group.revisionId
                    )
                )

                guard let viewerLauncher else {
                    callbacks?.onError(
                        placementKey: response.placementKey,
                        error: NSError(
                            domain: "OpenStory",
                            code: 1,
                            userInfo: [NSLocalizedDescriptionKey: "Story viewer is not available."]
                        )
                    )
                    return
                }

                viewerLauncher(self, response, index, group, callbacks)
            }
            groupRow.addArrangedSubview(view)
        }

        if !impressionSentForPlacement {
            callbacks?.onStoryBarImpression(
                event: OpenStoryAnalyticsEvent(
                    kind: .storyBarImpression,
                    placementKey: response.placementKey
                )
            )
            impressionSentForPlacement = true
        }
    }

    private func buildUI() {
        clipsToBounds = true

        emptyStateLabel.translatesAutoresizingMaskIntoConstraints = false
        emptyStateLabel.font = .systemFont(ofSize: 12, weight: .semibold)
        emptyStateLabel.textColor = UIColor(openStoryHex: "#6D3D18")
        emptyStateLabel.backgroundColor = UIColor(openStoryHex: "#FFE5D0")
        emptyStateLabel.layer.cornerRadius = 12
        emptyStateLabel.layer.masksToBounds = true
        emptyStateLabel.numberOfLines = 0
        emptyStateLabel.textAlignment = .left
        emptyStateLabel.textInsets = UIEdgeInsets(top: 12, left: 12, bottom: 12, right: 12)

        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.showsHorizontalScrollIndicator = false
        scrollView.clipsToBounds = true
        scrollView.delaysContentTouches = false
        scrollView.canCancelContentTouches = true
        scrollView.panGestureRecognizer.cancelsTouchesInView = false

        groupRow.translatesAutoresizingMaskIntoConstraints = false
        groupRow.axis = .horizontal
        groupRow.alignment = .top
        groupRow.spacing = 8
        groupRow.isLayoutMarginsRelativeArrangement = true
        groupRow.layoutMargins = UIEdgeInsets(top: 4, left: 4, bottom: 8, right: 4)

        addSubview(emptyStateLabel)
        addSubview(scrollView)
        scrollView.addSubview(groupRow)

        NSLayoutConstraint.activate([
            emptyStateLabel.topAnchor.constraint(equalTo: topAnchor),
            emptyStateLabel.leadingAnchor.constraint(equalTo: leadingAnchor),
            emptyStateLabel.trailingAnchor.constraint(equalTo: trailingAnchor),
            emptyStateLabel.bottomAnchor.constraint(equalTo: bottomAnchor),

            scrollView.topAnchor.constraint(equalTo: topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: bottomAnchor),

            groupRow.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            groupRow.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            groupRow.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            groupRow.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            groupRow.heightAnchor.constraint(equalTo: scrollView.frameLayoutGuide.heightAnchor),
        ])
    }
}

private final class StoryBarScrollView: UIScrollView {
    override func touchesShouldCancel(in view: UIView) -> Bool {
        if view is UIControl {
            return true
        }
        return super.touchesShouldCancel(in: view)
    }
}

private final class StoryBarGroupView: UIControl {
    private let titleLabel = UILabel()
    private let avatarContainer = UIView()
    private let ringView = GradientRingView(
        startColor: UIColor(openStoryHex: "#F59E0B"),
        endColor: UIColor(openStoryHex: "#8B5CF6"),
        strokeWidth: 4
    )
    private let imageView = UIImageView()
    private let badgeLabel = InsetLabel()
    private let bottomLabel = InsetLabel()
    var onTap: (() -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)
        buildUI()
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleTap))
        addGestureRecognizer(tapGesture)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        nil
    }

    func configure(
        group: SdkFeedGroupPayload,
        isCached: Bool,
        isViewed: Bool,
        titleColor: UIColor,
        viewedTitleColor: UIColor
    ) {
        let ringColors: (UIColor, UIColor)
        if isViewed {
            ringColors = (UIColor(openStoryHex: "#D8CEC2"), UIColor(openStoryHex: "#BDB2A6"))
        } else if isCached {
            ringColors = (UIColor(openStoryHex: "#C3A173"), UIColor(openStoryHex: "#B4845D"))
        } else {
            ringColors = (UIColor(openStoryHex: "#F59E0B"), UIColor(openStoryHex: "#8B5CF6"))
        }

        ringView.startColor = ringColors.0
        ringView.endColor = ringColors.1
        titleLabel.text = group.title
        titleLabel.textColor = isViewed ? viewedTitleColor : titleColor
        RemoteImageLoader.loadImage(from: group.logoURL, into: imageView)

        if let badge = group.badge, !badge.value.isEmpty {
            badgeLabel.isHidden = false
            bottomLabel.isHidden = true
            badgeLabel.text = badge.type == "svg" ? "SVG" : badge.value
        } else if let bottomLabelValue = group.bottomLabel, !bottomLabelValue.isEmpty {
            badgeLabel.isHidden = true
            bottomLabel.isHidden = false
            bottomLabel.text = bottomLabelValue
            bottomLabel.textColor = UIColor(openStoryHex: "#8B7502")
        } else {
            badgeLabel.isHidden = true
            bottomLabel.isHidden = true
        }
    }

    private func buildUI() {
        translatesAutoresizingMaskIntoConstraints = false

        let verticalStack = UIStackView()
        verticalStack.translatesAutoresizingMaskIntoConstraints = false
        verticalStack.isUserInteractionEnabled = false
        verticalStack.axis = .vertical
        verticalStack.alignment = .center
        verticalStack.spacing = 10

        avatarContainer.translatesAutoresizingMaskIntoConstraints = false
        avatarContainer.isUserInteractionEnabled = false

        ringView.translatesAutoresizingMaskIntoConstraints = false
        ringView.isUserInteractionEnabled = false
        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        imageView.layer.cornerRadius = 27
        imageView.backgroundColor = UIColor(white: 0.15, alpha: 1)
        imageView.isUserInteractionEnabled = false

        badgeLabel.translatesAutoresizingMaskIntoConstraints = false
        badgeLabel.isUserInteractionEnabled = false
        badgeLabel.font = .systemFont(ofSize: 14, weight: .regular)
        badgeLabel.textColor = .white
        badgeLabel.textAlignment = .center
        badgeLabel.baselineAdjustment = .alignCenters
        badgeLabel.backgroundColor = .black
        badgeLabel.layer.cornerRadius = 12
        badgeLabel.layer.masksToBounds = true
        badgeLabel.textInsets = .zero

        bottomLabel.translatesAutoresizingMaskIntoConstraints = false
        bottomLabel.isUserInteractionEnabled = false
        bottomLabel.font = .systemFont(ofSize: 10, weight: .bold)
        bottomLabel.backgroundColor = UIColor(openStoryHex: "#FDD74E")
        bottomLabel.textColor = UIColor(openStoryHex: "#8B7502")
        bottomLabel.layer.cornerRadius = 5
        bottomLabel.layer.masksToBounds = true
        bottomLabel.textInsets = UIEdgeInsets(top: 2, left: 7, bottom: 2, right: 7)

        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.isUserInteractionEnabled = false
        titleLabel.font = .systemFont(ofSize: 10, weight: .semibold)
        titleLabel.textAlignment = .center
        titleLabel.numberOfLines = 2

        avatarContainer.addSubview(ringView)
        avatarContainer.addSubview(imageView)
        avatarContainer.addSubview(badgeLabel)
        avatarContainer.addSubview(bottomLabel)

        verticalStack.addArrangedSubview(avatarContainer)
        verticalStack.addArrangedSubview(titleLabel)
        addSubview(verticalStack)

        NSLayoutConstraint.activate([
            verticalStack.topAnchor.constraint(equalTo: topAnchor),
            verticalStack.leadingAnchor.constraint(equalTo: leadingAnchor),
            verticalStack.trailingAnchor.constraint(equalTo: trailingAnchor),
            verticalStack.bottomAnchor.constraint(equalTo: bottomAnchor),
            verticalStack.widthAnchor.constraint(greaterThanOrEqualToConstant: 74),

            avatarContainer.widthAnchor.constraint(greaterThanOrEqualToConstant: 74),
            avatarContainer.heightAnchor.constraint(equalToConstant: 74),

            ringView.centerXAnchor.constraint(equalTo: avatarContainer.centerXAnchor),
            ringView.centerYAnchor.constraint(equalTo: avatarContainer.centerYAnchor),
            ringView.widthAnchor.constraint(equalToConstant: 66),
            ringView.heightAnchor.constraint(equalToConstant: 66),

            imageView.centerXAnchor.constraint(equalTo: avatarContainer.centerXAnchor),
            imageView.centerYAnchor.constraint(equalTo: avatarContainer.centerYAnchor),
            imageView.widthAnchor.constraint(equalToConstant: 54),
            imageView.heightAnchor.constraint(equalToConstant: 54),

            badgeLabel.trailingAnchor.constraint(equalTo: avatarContainer.trailingAnchor, constant: -2),
            badgeLabel.bottomAnchor.constraint(equalTo: avatarContainer.bottomAnchor, constant: -1),
            badgeLabel.heightAnchor.constraint(equalToConstant: 24),
            badgeLabel.widthAnchor.constraint(equalToConstant: 24),

            bottomLabel.centerXAnchor.constraint(equalTo: avatarContainer.centerXAnchor),
            bottomLabel.bottomAnchor.constraint(equalTo: avatarContainer.bottomAnchor, constant: -1),

            titleLabel.widthAnchor.constraint(lessThanOrEqualToConstant: 88),
        ])
    }

    @objc
    private func handleTap() {
        onTap?()
    }
}

internal extension UIColor {
    convenience init(openStoryHex value: String) {
        let hex = value.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int = UInt64()
        Scanner(string: hex).scanHexInt64(&int)

        let a, r, g, b: UInt64
        switch hex.count {
        case 8:
            (a, r, g, b) = (
                (int >> 24) & 0xff,
                (int >> 16) & 0xff,
                (int >> 8) & 0xff,
                int & 0xff
            )
        default:
            (a, r, g, b) = (255, (int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff)
        }

        self.init(
            red: CGFloat(r) / 255,
            green: CGFloat(g) / 255,
            blue: CGFloat(b) / 255,
            alpha: CGFloat(a) / 255
        )
    }
}

private final class InsetLabel: UILabel {
    var textInsets: UIEdgeInsets {
        didSet { invalidateIntrinsicContentSize() }
    }

    override init(frame: CGRect) {
        textInsets = .zero
        super.init(frame: frame)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        nil
    }

    override func drawText(in rect: CGRect) {
        super.drawText(in: rect.inset(by: textInsets))
    }

    override var intrinsicContentSize: CGSize {
        let baseSize = super.intrinsicContentSize
        return CGSize(
            width: baseSize.width + textInsets.left + textInsets.right,
            height: baseSize.height + textInsets.top + textInsets.bottom
        )
    }
}
#endif
