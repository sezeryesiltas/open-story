#if canImport(UIKit)
import AVFoundation
import UIKit

internal final class StoryViewerViewController: UIViewController, UIGestureRecognizerDelegate {
    private let response: SdkFeedResponsePayload
    private let groups: [SdkFeedGroupPayload]
    private let viewedStorySession: ViewedStorySession
    private weak var callbacks: (any OpenStoryCallbacks)?

    private let stageSurface = UIView()
    private let primaryStage = ViewerStageView()
    private let secondaryStage = ViewerStageView()
    private var activeStage: ViewerStageView
    private var inactiveStage: ViewerStageView

    private var currentGroupIndex: Int
    private var currentStoryIndex: Int
    private var currentPlayer: AVPlayer?
    private weak var currentPlayerSurfaceView: PlayerSurfaceView?
    private var currentTimeObserver: Any?
    private var playerDidEndObserver: NSObjectProtocol?
    private var imageAutoAdvanceTask: Task<Void, Never>?
    private var imageProgressTimer: Timer?
    private var imageProgressState = StoryPlaybackProgressState.started(defaultImageDurationMs)
    private var storyPlaybackStartedAtMs: CFTimeInterval = 0
    private var currentStoryProgressFraction: CGFloat = 0
    private var currentCTAContext: CTAContext?
    private var transitionDisplayLink: CADisplayLink?
    private var timedTransition: TimedTransitionAnimation?
    private var currentTransition: GroupTransitionState?
    private var isTransitionRunning = false
    private var panMode: PanMode = .idle
    private var pauseReasons: Set<PauseReason> = []
    private var downPoint: CGPoint = .zero
    private var viewerClosedReported = false
    private var isMuted = true
    private var foregroundObservers: [NSObjectProtocol] = []

    init(
        response: SdkFeedResponsePayload,
        initialGroupIndex: Int,
        initialStoryIndex: Int,
        viewedStorySession: ViewedStorySession,
        callbacks: (any OpenStoryCallbacks)?
    ) {
        self.response = response
        groups = response.resolvedSet?.groups ?? []
        currentGroupIndex = initialGroupIndex
        currentStoryIndex = initialStoryIndex
        self.viewedStorySession = viewedStorySession
        self.callbacks = callbacks
        activeStage = primaryStage
        inactiveStage = secondaryStage
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .fullScreen
        modalTransitionStyle = .crossDissolve
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        nil
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        buildUI()
        bindGestures()
        bindLifecycleNotifications()
        renderCurrentStory()
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        if isBeingDismissed || presentingViewController == nil {
            cleanupPlayback()
            cleanupForegroundObservers()
            reportViewerClosedIfNeeded()
        }
    }

    private func buildUI() {
        view.backgroundColor = .black

        stageSurface.translatesAutoresizingMaskIntoConstraints = false
        stageSurface.clipsToBounds = false
        // Apply one shared perspective camera to both faces so they rotate into the same hinge line.
        var perspective = CATransform3DIdentity
        perspective.m34 = -1 / cubePerspectiveDistance
        stageSurface.layer.sublayerTransform = perspective

        activeStage = primaryStage
        inactiveStage = secondaryStage
        inactiveStage.isHidden = true

        for stage in [inactiveStage, activeStage] {
            stage.translatesAutoresizingMaskIntoConstraints = false
            stage.soundButton.addTarget(self, action: #selector(toggleSound), for: .touchUpInside)
            stage.closeButton.addTarget(self, action: #selector(closeButtonTapped), for: .touchUpInside)
            stage.ctaButton.addTarget(self, action: #selector(handleCTATap), for: .touchUpInside)
            stageSurface.addSubview(stage)
            NSLayoutConstraint.activate([
                stage.topAnchor.constraint(equalTo: stageSurface.topAnchor),
                stage.leadingAnchor.constraint(equalTo: stageSurface.leadingAnchor),
                stage.trailingAnchor.constraint(equalTo: stageSurface.trailingAnchor),
                stage.bottomAnchor.constraint(equalTo: stageSurface.bottomAnchor),
            ])
        }

        view.addSubview(stageSurface)
        NSLayoutConstraint.activate([
            stageSurface.topAnchor.constraint(equalTo: view.topAnchor),
            stageSurface.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            stageSurface.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            stageSurface.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        updateStageInteractivity()
    }

    private func bindGestures() {
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
        tapGesture.delegate = self

        let panGesture = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        panGesture.delegate = self
        panGesture.maximumNumberOfTouches = 1

        let longPressGesture = UILongPressGestureRecognizer(target: self, action: #selector(handleLongPress(_:)))
        longPressGesture.minimumPressDuration = 0.25
        longPressGesture.delegate = self

        stageSurface.addGestureRecognizer(tapGesture)
        stageSurface.addGestureRecognizer(panGesture)
        stageSurface.addGestureRecognizer(longPressGesture)
    }

    private func bindLifecycleNotifications() {
        let center = NotificationCenter.default
        foregroundObservers = [
            center.addObserver(
                forName: UIApplication.didEnterBackgroundNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                Task { @MainActor [weak self] in
                    self?.addPauseReason(.background)
                }
            },
            center.addObserver(
                forName: UIApplication.willEnterForegroundNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                Task { @MainActor [weak self] in
                    self?.removePauseReason(.background)
                }
            },
        ]
    }

    private func renderCurrentStory(shouldReportStoryView: Bool = true) {
        guard let group = currentGroupOrNil(), let story = currentStoryOrNil() else {
            closeViewer()
            return
        }

        currentStoryProgressFraction = 0
        activeStage.titleLabel.text = group.title
        RemoteImageLoader.loadImage(from: group.logoURL, into: activeStage.avatarImageView)
        updateProgressIndicators(
            stage: activeStage,
            group: group,
            activeStoryIndex: currentStoryIndex,
            activeStoryRevisionId: story.revisionId,
            progressFraction: currentStoryProgressFraction
        )
        renderMedia(story)
        bindCTA(
            stage: activeStage,
            group: group,
            story: story,
            interactive: true
        )
        updateChromeVisibility(animated: false)

        if shouldReportStoryView {
            reportStoryView(group: group, story: story)
        }
    }

    private func updateProgressIndicators(
        stage: ViewerStageView,
        group: SdkFeedGroupPayload,
        activeStoryIndex: Int,
        activeStoryRevisionId: String,
        progressFraction: CGFloat
    ) {
        stage.progressStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        stage.progressSegments.removeAll()

        for (index, story) in group.stories.enumerated() {
            let segment = ProgressSegmentView()
            segment.translatesAutoresizingMaskIntoConstraints = false
            segment.progress = {
                if index < activeStoryIndex {
                    return 1
                }
                if story.revisionId == activeStoryRevisionId {
                    return progressFraction
                }
                return 0
            }()

            stage.progressStack.addArrangedSubview(segment)
            stage.progressSegments.append(segment)
            NSLayoutConstraint.activate([
                segment.heightAnchor.constraint(equalToConstant: 3),
            ])
        }
    }

    private func renderPreviewStage(
        _ stage: ViewerStageView,
        groupIndex: Int,
        storyIndex: Int
    ) {
        guard
            let group = groups[safe: groupIndex],
            let story = group.stories[safe: storyIndex]
        else {
            return
        }

        stage.titleLabel.text = group.title
        RemoteImageLoader.loadImage(from: group.logoURL, into: stage.avatarImageView)
        updateProgressIndicators(
            stage: stage,
            group: group,
            activeStoryIndex: storyIndex,
            activeStoryRevisionId: story.revisionId,
            progressFraction: 0
        )
        renderPreviewMedia(stage: stage, story: story)
        bindCTA(stage: stage, group: group, story: story, interactive: false)
        stage.soundButton.isHidden = story.mediaType != "video"
        updateSoundButtons()
        updateChromeVisibility(animated: false)
    }

    private func renderMedia(_ story: SdkFeedStoryPayload) {
        cleanupPlayback()
        activeStage.mediaHost.subviews.forEach { $0.removeFromSuperview() }
        imageProgressState = StoryPlaybackProgressState.started(Self.defaultImageDurationMs)
        storyPlaybackStartedAtMs = 0

        addMediaBackdrop(
            to: activeStage.mediaHost,
            imageURL: story.viewerBackdropImageURL
        )

        if story.mediaType == "video", let url = URL(string: story.asset.url) {
            let player = AVPlayer(url: url)
            player.isMuted = isMuted
            let playerSurfaceView = PlayerSurfaceView()
            playerSurfaceView.translatesAutoresizingMaskIntoConstraints = false
            playerSurfaceView.player = player
            playerSurfaceView.playerLayer.videoGravity = .resizeAspect
            activateWidthFittedMediaConstraints(
                for: playerSurfaceView,
                in: activeStage.mediaHost,
                width: story.asset.width,
                height: story.asset.height
            )

            currentPlayer = player
            currentPlayerSurfaceView = playerSurfaceView
            activeStage.soundButton.isHidden = false
            updateSoundButtons()
            startVideoProgressMonitoring(player: player, story: story)

            playerDidEndObserver = NotificationCenter.default.addObserver(
                forName: .AVPlayerItemDidPlayToEndTime,
                object: player.currentItem,
                queue: .main
            ) { [weak self] _ in
                Task { @MainActor [weak self] in
                    self?.updateCurrentStoryProgress(1)
                    self?.handleStoryCompletedByPlayback()
                }
            }

            if pauseReasons.isEmpty {
                player.play()
            }
            return
        }

        addWidthFittedImageView(
            to: activeStage.mediaHost,
            imageURL: story.asset.url,
            asset: story.asset
        )

        activeStage.soundButton.isHidden = true
        imageProgressState = StoryPlaybackProgressState.started(story.imageDurationMs ?? Self.defaultImageDurationMs)
        startImageAutoAdvanceIfEligible()
    }

    private func renderPreviewMedia(
        stage: ViewerStageView,
        story: SdkFeedStoryPayload
    ) {
        stage.mediaHost.subviews.forEach { $0.removeFromSuperview() }
        let previewURL = story.posterAsset?.url ?? story.asset.url
        addMediaBackdrop(
            to: stage.mediaHost,
            imageURL: story.viewerBackdropImageURL
        )

        let imageView = UIImageView()
        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.contentMode = .scaleAspectFill

        if let cachedPreview = RemoteImageLoader.cachedImage(from: previewURL) {
            imageView.image = cachedPreview
        }
        addWidthFittedImageView(
            imageView,
            to: stage.mediaHost,
            imageURL: previewURL,
            asset: story.posterAsset ?? story.asset
        )
    }

    private func addWidthFittedImageView(
        to mediaHost: UIView,
        imageURL: String?,
        asset: SdkFeedAssetPayload
    ) {
        addWidthFittedImageView(
            UIImageView(),
            to: mediaHost,
            imageURL: imageURL,
            asset: asset
        )
    }

    private func addWidthFittedImageView(
        _ imageView: UIImageView,
        to mediaHost: UIView,
        imageURL: String?,
        asset: SdkFeedAssetPayload
    ) {
        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true

        var heightConstraint = activateWidthFittedMediaConstraints(
            for: imageView,
            in: mediaHost,
            width: asset.width,
            height: asset.height
        )
        let hasAssetAspect = Self.aspectMultiplier(width: asset.width, height: asset.height) != nil

        func applyImageAspect(_ image: UIImage?) {
            guard
                !hasAssetAspect,
                let image,
                image.size.width > 0,
                image.size.height > 0
            else {
                return
            }

            heightConstraint.isActive = false
            heightConstraint = imageView.heightAnchor.constraint(
                equalTo: imageView.widthAnchor,
                multiplier: image.size.height / image.size.width
            )
            heightConstraint.isActive = true
        }

        applyImageAspect(imageView.image)
        RemoteImageLoader.loadImage(
            from: imageURL,
            into: imageView,
            onImageSet: applyImageAspect
        )
    }

    @discardableResult
    private func activateWidthFittedMediaConstraints(
        for mediaView: UIView,
        in mediaHost: UIView,
        width: Int?,
        height: Int?
    ) -> NSLayoutConstraint {
        mediaHost.addSubview(mediaView)

        let heightConstraint: NSLayoutConstraint
        if let aspectMultiplier = Self.aspectMultiplier(width: width, height: height) {
            heightConstraint = mediaView.heightAnchor.constraint(
                equalTo: mediaView.widthAnchor,
                multiplier: aspectMultiplier
            )
        } else {
            heightConstraint = mediaView.heightAnchor.constraint(equalTo: mediaHost.heightAnchor)
        }

        NSLayoutConstraint.activate([
            mediaView.leadingAnchor.constraint(equalTo: mediaHost.leadingAnchor),
            mediaView.trailingAnchor.constraint(equalTo: mediaHost.trailingAnchor),
            mediaView.centerYAnchor.constraint(equalTo: mediaHost.centerYAnchor),
            heightConstraint,
        ])

        return heightConstraint
    }

    private static func aspectMultiplier(width: Int?, height: Int?) -> CGFloat? {
        guard
            let width,
            let height,
            width > 0,
            height > 0
        else {
            return nil
        }

        return CGFloat(height) / CGFloat(width)
    }

    private func bindCTA(
        stage: ViewerStageView,
        group: SdkFeedGroupPayload,
        story: SdkFeedStoryPayload,
        interactive: Bool
    ) {
        guard let cta = story.cta else {
            stage.ctaButton.isHidden = true
            stage.ctaButton.alpha = 0
            stage.ctaButton.isUserInteractionEnabled = false
            if stage === activeStage {
                currentCTAContext = nil
            }
            return
        }

        stage.ctaButton.isHidden = false
        stage.ctaButton.alpha = pauseReasons.contains(.longPress) ? 0 : 1
        stage.ctaButton.isUserInteractionEnabled = interactive && !pauseReasons.contains(.longPress)
        stage.ctaButton.setTitle(cta.label, for: .normal)

        if interactive, stage === activeStage {
            currentCTAContext = CTAContext(group: group, story: story, cta: cta)
        }
    }

    private func reportStoryView(
        group: SdkFeedGroupPayload,
        story: SdkFeedStoryPayload
    ) {
        viewedStorySession.markStoryViewed(story.revisionId)
        callbacks?.onStoryView(
            event: OpenStoryAnalyticsEvent(
                kind: .storyView,
                placementKey: response.placementKey,
                storyGroupId: group.id,
                storyGroupRevisionId: group.revisionId,
                storyId: story.id,
                storyRevisionId: story.revisionId
            )
        )
    }

    private func handleStoryCompletedByPlayback() {
        guard let group = currentGroupOrNil(), let story = currentStoryOrNil() else {
            return
        }

        callbacks?.onStoryComplete(
            event: OpenStoryAnalyticsEvent(
                kind: .storyComplete,
                placementKey: response.placementKey,
                storyGroupId: group.id,
                storyGroupRevisionId: group.revisionId,
                storyId: story.id,
                storyRevisionId: story.revisionId
            )
        )

        if currentStoryIndex == group.stories.indices.last {
            callbacks?.onGroupComplete(
                event: OpenStoryAnalyticsEvent(
                    kind: .groupComplete,
                    placementKey: response.placementKey,
                    storyGroupId: group.id,
                    storyGroupRevisionId: group.revisionId
                )
            )
        }

        navigateForward(manual: false)
    }

    private func navigateBackward() {
        if currentStoryIndex > 0 {
            currentStoryIndex -= 1
            renderCurrentStory()
            return
        }

        guard currentGroupIndex > 0 else {
            return
        }

        let targetGroupIndex = currentGroupIndex - 1
        let targetStoryIndex = max(0, groups[targetGroupIndex].stories.count - 1)
        navigateToGroup(
            targetGroupIndex: targetGroupIndex,
            targetStoryIndex: targetStoryIndex,
            direction: .backward
        )
    }

    private func navigateForward(manual: Bool) {
        guard let group = currentGroupOrNil() else {
            closeViewer()
            return
        }

        if currentStoryIndex < group.stories.count - 1 {
            currentStoryIndex += 1
            renderCurrentStory()
            return
        }

        if currentGroupIndex < groups.count - 1 {
            let targetGroupIndex = currentGroupIndex + 1
            navigateToGroup(
                targetGroupIndex: targetGroupIndex,
                targetStoryIndex: viewedStorySession.firstUnviewedStoryIndex(in: groups[targetGroupIndex]),
                direction: .forward
            )
            return
        }

        if !manual {
            closeViewer()
        }
    }

    private func navigateToGroup(
        targetGroupIndex: Int,
        targetStoryIndex: Int,
        direction: GroupDirection
    ) {
        guard groups.indices.contains(targetGroupIndex), !isTransitionRunning else {
            return
        }

        let targetGroup = groups[targetGroupIndex]
        let clampedTargetStoryIndex = max(0, min(targetStoryIndex, max(0, targetGroup.stories.count - 1)))

        guard stageSurface.bounds.width > 0 else {
            currentGroupIndex = targetGroupIndex
            currentStoryIndex = clampedTargetStoryIndex
            renderCurrentStory()
            return
        }

        guard beginGroupTransition(
            targetGroupIndex: targetGroupIndex,
            targetStoryIndex: clampedTargetStoryIndex,
            direction: direction
        ) else {
            return
        }

        animateCurrentTransition(to: 1)
    }

    private func beginGroupTransition(
        targetGroupIndex: Int,
        targetStoryIndex: Int,
        direction: GroupDirection
    ) -> Bool {
        guard groups.indices.contains(targetGroupIndex) else {
            return false
        }

        if let currentTransition {
            return currentTransition.targetGroupIndex == targetGroupIndex &&
                currentTransition.targetStoryIndex == targetStoryIndex &&
                currentTransition.direction == direction
        }

        stopTimedTransitionAnimation()
        isTransitionRunning = true
        addPauseReason(.transition)
        updateStageInteractivity()
        inactiveStage.isHidden = false

        currentTransition = GroupTransitionState(
            sourceStage: activeStage,
            targetStage: inactiveStage,
            targetGroupIndex: targetGroupIndex,
            targetStoryIndex: targetStoryIndex,
            direction: direction,
            progress: 0
        )
        renderPreviewStage(inactiveStage, groupIndex: targetGroupIndex, storyIndex: targetStoryIndex)
        applyGroupTransitionProgress(0)
        return true
    }

    private func updateInteractiveGroupTransition(deltaX: CGFloat) -> Bool {
        let direction: GroupDirection = deltaX < 0 ? .forward : .backward
        let targetGroupIndex = direction == .forward ? currentGroupIndex + 1 : currentGroupIndex - 1
        guard groups.indices.contains(targetGroupIndex) else {
            return false
        }

        let targetStoryIndex = direction == .forward
            ? viewedStorySession.firstUnviewedStoryIndex(in: groups[targetGroupIndex])
            : max(0, groups[targetGroupIndex].stories.count - 1)

        guard beginGroupTransition(
            targetGroupIndex: targetGroupIndex,
            targetStoryIndex: targetStoryIndex,
            direction: direction
        ) else {
            return false
        }

        let progress = min(1, max(0, abs(deltaX) / max(1, stageSurface.bounds.width)))
        applyGroupTransitionProgress(progress)
        return true
    }

    private func animateCurrentTransition(to targetProgress: CGFloat) {
        guard let transition = currentTransition else {
            return
        }

        stopTimedTransitionAnimation()
        let startProgress = transition.progress
        guard abs(targetProgress - startProgress) > 0.0001 else {
            if abs(targetProgress - 1) < 0.0001 {
                finishCurrentTransition()
            } else {
                cancelCurrentTransition()
            }
            return
        }

        let duration = max(0.18, 0.42 * abs(targetProgress - startProgress))
        timedTransition = TimedTransitionAnimation(
            startProgress: startProgress,
            targetProgress: targetProgress,
            duration: duration,
            startedAt: nil
        )

        let displayLink = CADisplayLink(target: self, selector: #selector(handleTimedTransitionFrame(_:)))
        transitionDisplayLink = displayLink
        displayLink.add(to: .main, forMode: .common)
    }

    @objc
    private func handleTimedTransitionFrame(_ displayLink: CADisplayLink) {
        guard var animation = timedTransition else {
            stopTimedTransitionAnimation()
            return
        }

        if animation.startedAt == nil {
            animation.startedAt = displayLink.timestamp
            timedTransition = animation
        }

        guard let startedAt = animation.startedAt else {
            return
        }

        let elapsed = max(0, displayLink.timestamp - startedAt)
        let fraction = min(1, CGFloat(elapsed / animation.duration))
        let easedFraction = 1 - pow(1 - fraction, 3)
        let progress = animation.startProgress + ((animation.targetProgress - animation.startProgress) * easedFraction)
        applyGroupTransitionProgress(progress)

        if fraction >= 1 {
            let targetProgress = animation.targetProgress
            stopTimedTransitionAnimation()
            if abs(targetProgress - 1) < 0.0001 {
                finishCurrentTransition()
            } else {
                cancelCurrentTransition()
            }
        }
    }

    private func stopTimedTransitionAnimation() {
        transitionDisplayLink?.invalidate()
        transitionDisplayLink = nil
        timedTransition = nil
    }

    private func applyGroupTransitionProgress(_ progress: CGFloat) {
        guard var transition = currentTransition else {
            return
        }

        let clamped = min(1, max(0, progress))
        transition.progress = clamped
        currentTransition = transition
        transition.sourceStage.isHidden = false
        transition.targetStage.isHidden = false

        // Keep the hinge side explicit. Deriving it from `position` breaks at progress == 0,
        // where source and target faces can both sit on opposite cube edges with the same value.
        applyCubeTransform(
            stage: transition.sourceStage,
            position: transition.direction == .forward ? -clamped : clamped,
            hingeEdge: transition.direction == .forward ? .trailing : .leading
        )
        applyCubeTransform(
            stage: transition.targetStage,
            position: transition.direction == .forward ? 1 - clamped : clamped - 1,
            hingeEdge: transition.direction == .forward ? .leading : .trailing
        )

        if clamped < 0.5 {
            stageSurface.bringSubviewToFront(transition.sourceStage)
        } else {
            stageSurface.bringSubviewToFront(transition.targetStage)
        }
    }

    private func applyCubeTransform(
        stage: ViewerStageView,
        position: CGFloat,
        hingeEdge: CubeHingeEdge
    ) {
        let width = stage.bounds.width
        guard width > 0 else {
            return
        }

        let magnitude = abs(position)
        let angle = cubeRotationRadians * position
        // Pivot offset from the layer center to the hinge edge.
        let pivotX: CGFloat = (hingeEdge == .trailing) ? width / 2 : -width / 2

        // Build the cube face transform entirely in the transform matrix so that
        // anchorPoint and position stay at their Auto-Layout-friendly defaults.
        //
        // Reading right-to-left (application order):
        //   1. shift so the hinge edge sits at the layer origin
        //   2. rotate around Y at the hinge
        //   3. shift back
        //   4. slide the whole face to track the cube surface
        var transform = CATransform3DIdentity
        transform = CATransform3DTranslate(transform, width * position + pivotX, 0, 0)
        transform = CATransform3DRotate(transform, angle, 0, 1, 0)
        transform = CATransform3DTranslate(transform, -pivotX, 0, 0)
        stage.layer.transform = transform
        stage.alpha = 1
        stage.layer.shadowOpacity = Float(min(0.24, magnitude * 0.24))
        stage.layer.shadowRadius = 34
        stage.layer.shadowOffset = CGSize(width: -14 * position, height: 0)
        stage.transitionShade.alpha = min(cubeShadeMaxAlpha, magnitude * cubeShadeMaxAlpha)
    }

    private func finishCurrentTransition() {
        guard let transition = currentTransition else {
            return
        }

        stopTimedTransitionAnimation()
        currentGroupIndex = transition.targetGroupIndex
        currentStoryIndex = transition.targetStoryIndex
        activeStage = transition.targetStage
        inactiveStage = transition.sourceStage
        resetStageTransform(activeStage)
        resetStageTransform(inactiveStage)
        inactiveStage.isHidden = true
        currentTransition = nil
        isTransitionRunning = false
        removePauseReason(.transition)
        updateStageInteractivity()
        renderCurrentStory()
    }

    private func cancelCurrentTransition() {
        guard let transition = currentTransition else {
            return
        }

        stopTimedTransitionAnimation()
        resetStageTransform(transition.sourceStage)
        resetStageTransform(transition.targetStage)
        transition.targetStage.isHidden = true
        currentTransition = nil
        isTransitionRunning = false
        removePauseReason(.transition)
        updateStageInteractivity()
    }

    private func resetStageTransform(_ stage: ViewerStageView) {
        stage.layer.transform = CATransform3DIdentity
        stage.alpha = 1
        stage.layer.shadowOpacity = 0
        stage.transitionShade.alpha = 0
    }

    private func updateStageInteractivity() {
        // Stage buttons bypass the stageSurface gesture guards, so lock both faces directly while
        // a cube transition is active and only re-enable the settled front face afterwards.
        activeStage.isUserInteractionEnabled = !isTransitionRunning
        inactiveStage.isUserInteractionEnabled = false
    }

    private func startImageAutoAdvanceIfEligible() {
        guard pauseReasons.isEmpty, imageAutoAdvanceTask == nil else {
            return
        }

        let delayMs = max(1, imageProgressState.remainingDurationMs)
        storyPlaybackStartedAtMs = CACurrentMediaTime()
        startImageProgressTimer()
        imageAutoAdvanceTask = Task { [weak self] in
            let durationNs = UInt64(delayMs) * 1_000_000
            try? await Task.sleep(nanoseconds: durationNs)
            guard !Task.isCancelled else { return }
            await MainActor.run {
                guard let self else { return }
                self.imageProgressState = self.imageProgressState.afterElapsed(delayMs)
                self.storyPlaybackStartedAtMs = 0
                self.currentStoryProgressFraction = 1
                self.updateCurrentStoryProgress(1)
                self.handleStoryCompletedByPlayback()
            }
        }
    }

    private func startImageProgressTimer() {
        imageProgressTimer?.invalidate()
        currentStoryProgressFraction = imageProgressState.fractionCompleted()
        updateCurrentStoryProgress(currentStoryProgressFraction)
        imageProgressTimer = Timer.scheduledTimer(withTimeInterval: 1 / 30, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                let elapsedMs = Int64(max(0, (CACurrentMediaTime() - self.storyPlaybackStartedAtMs) * 1_000))
                let progressState = self.imageProgressState.afterElapsed(elapsedMs)
                self.currentStoryProgressFraction = progressState.fractionCompleted()
                self.updateCurrentStoryProgress(self.currentStoryProgressFraction)
            }
        }
        RunLoop.main.add(imageProgressTimer!, forMode: .common)
    }

    private func startVideoProgressMonitoring(
        player: AVPlayer,
        story: SdkFeedStoryPayload
    ) {
        updateCurrentStoryProgress(0)
        let interval = CMTime(seconds: 1 / 30, preferredTimescale: 600)
        currentTimeObserver = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            Task { @MainActor [weak self] in
                guard let self else { return }
                let currentDuration = player.currentItem?.duration.seconds ?? 0
                let fallbackDuration = Double(story.asset.durationMs ?? 0) / 1_000
                let duration = currentDuration.isFinite && currentDuration > 0 ? currentDuration : fallbackDuration
                guard duration > 0 else { return }
                self.currentStoryProgressFraction = min(1, max(0, time.seconds / duration))
                self.updateCurrentStoryProgress(self.currentStoryProgressFraction)
            }
        }
    }

    private func updateCurrentStoryProgress(_ fraction: CGFloat) {
        for (index, segment) in activeStage.progressSegments.enumerated() {
            if index < currentStoryIndex {
                segment.progress = 1
            } else if index == currentStoryIndex {
                segment.progress = fraction
            } else {
                segment.progress = 0
            }
        }
    }

    private func cleanupPlayback() {
        imageAutoAdvanceTask?.cancel()
        imageAutoAdvanceTask = nil
        imageProgressTimer?.invalidate()
        imageProgressTimer = nil
        storyPlaybackStartedAtMs = 0

        if let currentPlayer, let currentTimeObserver {
            currentPlayer.removeTimeObserver(currentTimeObserver)
        }
        currentTimeObserver = nil

        if let playerDidEndObserver {
            NotificationCenter.default.removeObserver(playerDidEndObserver)
        }
        playerDidEndObserver = nil

        currentPlayer?.pause()
        currentPlayer = nil
        currentPlayerSurfaceView?.player = nil
        currentPlayerSurfaceView = nil
    }

    private func cleanupForegroundObservers() {
        foregroundObservers.forEach(NotificationCenter.default.removeObserver(_:))
        foregroundObservers.removeAll()
    }

    private func addMediaBackdrop(
        to mediaHost: UIView,
        imageURL: String?
    ) {
        guard imageURL != nil else {
            return
        }

        let backdropImageView = UIImageView()
        backdropImageView.translatesAutoresizingMaskIntoConstraints = false
        backdropImageView.alpha = 0.28
        backdropImageView.contentMode = .scaleAspectFill
        mediaHost.addSubview(backdropImageView)
        NSLayoutConstraint.activate([
            backdropImageView.topAnchor.constraint(equalTo: mediaHost.topAnchor),
            backdropImageView.leadingAnchor.constraint(equalTo: mediaHost.leadingAnchor),
            backdropImageView.trailingAnchor.constraint(equalTo: mediaHost.trailingAnchor),
            backdropImageView.bottomAnchor.constraint(equalTo: mediaHost.bottomAnchor),
        ])
        RemoteImageLoader.loadImage(from: imageURL, into: backdropImageView)

        let overlay = UIView()
        overlay.translatesAutoresizingMaskIntoConstraints = false
        overlay.backgroundColor = UIColor.black.withAlphaComponent(0.23)
        mediaHost.addSubview(overlay)
        NSLayoutConstraint.activate([
            overlay.topAnchor.constraint(equalTo: mediaHost.topAnchor),
            overlay.leadingAnchor.constraint(equalTo: mediaHost.leadingAnchor),
            overlay.trailingAnchor.constraint(equalTo: mediaHost.trailingAnchor),
            overlay.bottomAnchor.constraint(equalTo: mediaHost.bottomAnchor),
        ])
    }

    private func pauseCurrentStory() {
        guard let story = currentStoryOrNil() else {
            return
        }

        if story.mediaType == "video" {
            currentPlayer?.pause()
            return
        }

        if imageAutoAdvanceTask != nil {
            let elapsedMs = Int64(max(0, (CACurrentMediaTime() - storyPlaybackStartedAtMs) * 1_000))
            imageProgressState = imageProgressState.afterElapsed(elapsedMs)
            currentStoryProgressFraction = imageProgressState.fractionCompleted()
            updateCurrentStoryProgress(currentStoryProgressFraction)
            imageAutoAdvanceTask?.cancel()
            imageAutoAdvanceTask = nil
            imageProgressTimer?.invalidate()
            imageProgressTimer = nil
            storyPlaybackStartedAtMs = 0
        }
    }

    private func resumeCurrentStory() {
        guard let story = currentStoryOrNil() else {
            return
        }

        if story.mediaType == "video" {
            currentPlayer?.play()
            return
        }

        startImageAutoAdvanceIfEligible()
    }

    private func addPauseReason(_ reason: PauseReason) {
        let inserted = pauseReasons.insert(reason).inserted
        guard inserted else { return }
        applyPauseState()
    }

    private func removePauseReason(_ reason: PauseReason) {
        let removed = pauseReasons.remove(reason) != nil
        guard removed else { return }
        applyPauseState()
    }

    private func applyPauseState() {
        updateChromeVisibility(animated: true)
        if pauseReasons.isEmpty {
            resumeCurrentStory()
        } else {
            pauseCurrentStory()
        }
    }

    private func updateChromeVisibility(animated: Bool) {
        let shouldHideChrome = pauseReasons.contains(.longPress)
        let updates = {
            [self.activeStage, self.inactiveStage].forEach { stage in
                stage.topChrome.alpha = shouldHideChrome ? 0 : 1
                stage.topChrome.isUserInteractionEnabled = !shouldHideChrome

                let shouldShowCTA = !stage.ctaButton.isHidden && !shouldHideChrome
                stage.ctaButton.alpha = shouldShowCTA ? 1 : 0
                stage.ctaButton.isUserInteractionEnabled = shouldShowCTA
            }
        }

        guard animated else {
            updates()
            return
        }

        UIView.animate(
            withDuration: 0.18,
            delay: 0,
            options: [.beginFromCurrentState, .allowUserInteraction]
        ) {
            updates()
        }
    }

    private func updateSoundButtons() {
        let imageName = isMuted ? "speaker.slash.fill" : "speaker.wave.2.fill"
        [activeStage, inactiveStage].forEach {
            $0.soundButton.setImage(UIImage(systemName: imageName), for: .normal)
            $0.soundButton.setTitle(nil, for: .normal)
        }
        currentPlayer?.isMuted = isMuted
    }

    private func currentGroupOrNil() -> SdkFeedGroupPayload? {
        groups[safe: currentGroupIndex]
    }

    private func currentStoryOrNil() -> SdkFeedStoryPayload? {
        currentGroupOrNil()?.stories[safe: currentStoryIndex]
    }

    @objc
    private func toggleSound() {
        isMuted.toggle()
        currentPlayer?.isMuted = isMuted
        updateSoundButtons()
    }

    @objc
    private func closeButtonTapped() {
        closeViewer()
    }

    @objc
    private func handleCTATap() {
        guard let context = currentCTAContext else {
            return
        }

        let payload = OpenStoryCtaPayload(
            placementKey: response.placementKey,
            storyGroupId: context.group.id,
            storyGroupRevisionId: context.group.revisionId,
            storyId: context.story.id,
            storyRevisionId: context.story.revisionId,
            label: context.cta.label,
            targetType: context.cta.type == "deeplink" ? .deeplink : .url,
            targetValue: context.cta.value
        )

        closeViewer { [weak self] in
            self?.callbacks?.onStoryCtaTap(payload: payload)
        }
    }

    @objc
    private func handleTap(_ recognizer: UITapGestureRecognizer) {
        guard !isTransitionRunning else {
            return
        }

        let point = recognizer.location(in: stageSurface)
        let direction = storyViewerTapDirection(
            tapX: Double(point.x),
            width: Double(stageSurface.bounds.width)
        )
        if direction == .backward {
            navigateBackward()
        } else {
            navigateForward(manual: true)
        }
    }

    @objc
    private func handleLongPress(_ recognizer: UILongPressGestureRecognizer) {
        switch recognizer.state {
        case .began:
            addPauseReason(.longPress)
        case .ended, .cancelled, .failed:
            removePauseReason(.longPress)
        default:
            break
        }
    }

    @objc
    private func handlePan(_ recognizer: UIPanGestureRecognizer) {
        switch recognizer.state {
        case .began:
            guard !isTransitionRunning else { return }
            downPoint = recognizer.location(in: stageSurface)
            panMode = .pending
        case .changed:
            let translation = recognizer.translation(in: stageSurface)
            if panMode == .pending {
                if abs(translation.y) > gestureThreshold, abs(translation.y) > abs(translation.x) {
                    panMode = .vertical
                } else if abs(translation.x) > gestureThreshold, abs(translation.x) > abs(translation.y) {
                    panMode = .horizontal
                }
            }

            switch panMode {
            case .vertical:
                let translationY = max(0, translation.y)
                stageSurface.transform = CGAffineTransform(translationX: 0, y: translationY)
                stageSurface.alpha = max(0.65, 1 - (translationY / max(1, stageSurface.bounds.height * 0.45)))
            case .horizontal:
                _ = updateInteractiveGroupTransition(deltaX: translation.x)
            default:
                break
            }
        case .ended, .cancelled, .failed:
            let translation = recognizer.translation(in: stageSurface)
            switch panMode {
            case .vertical:
                if translation.y >= swipeDismissThreshold {
                    closeViewer()
                } else {
                    resetStageSurfacePosition()
                }
            case .horizontal:
                if let transition = currentTransition {
                    if transition.progress >= interactiveGroupSwipeCompletionThreshold {
                        animateCurrentTransition(to: 1)
                    } else {
                        animateCurrentTransition(to: 0)
                    }
                }
            default:
                break
            }
            panMode = .idle
        default:
            break
        }
    }

    private func resetStageSurfacePosition() {
        UIView.animate(withDuration: 0.18) {
            self.stageSurface.transform = .identity
            self.stageSurface.alpha = 1
        }
    }

    private func closeViewer(completion: (() -> Void)? = nil) {
        cleanupPlayback()
        cleanupForegroundObservers()
        reportViewerClosedIfNeeded()
        dismiss(animated: false, completion: completion)
    }

    private func reportViewerClosedIfNeeded() {
        guard !viewerClosedReported else {
            return
        }

        viewerClosedReported = true
        let group = currentGroupOrNil()
        let story = currentStoryOrNil()
        callbacks?.onViewerClose(
            event: OpenStoryAnalyticsEvent(
                kind: .viewerClose,
                placementKey: response.placementKey,
                storyGroupId: group?.id,
                storyGroupRevisionId: group?.revisionId,
                storyId: story?.id,
                storyRevisionId: story?.revisionId
            )
        )
    }

    static func show(
        anchorView: UIView,
        response: SdkFeedResponsePayload,
        initialGroupIndex: Int,
        initialStoryIndex: Int,
        viewedStorySession: ViewedStorySession,
        callbacks: (any OpenStoryCallbacks)?
    ) -> Bool {
        guard
            let presenter = anchorView.openStoryPresentationViewController(),
            presenter.viewIfLoaded?.window != nil,
            presenter.presentedViewController == nil
        else {
            return false
        }

        let viewer = StoryViewerViewController(
            response: response,
            initialGroupIndex: initialGroupIndex,
            initialStoryIndex: initialStoryIndex,
            viewedStorySession: viewedStorySession,
            callbacks: callbacks
        )
        presenter.present(viewer, animated: false)
        return true
    }

    private struct CTAContext {
        let group: SdkFeedGroupPayload
        let story: SdkFeedStoryPayload
        let cta: SdkFeedCtaPayload
    }

    private struct GroupTransitionState {
        let sourceStage: ViewerStageView
        let targetStage: ViewerStageView
        let targetGroupIndex: Int
        let targetStoryIndex: Int
        let direction: GroupDirection
        var progress: CGFloat
    }

    private struct TimedTransitionAnimation {
        let startProgress: CGFloat
        let targetProgress: CGFloat
        let duration: CFTimeInterval
        var startedAt: CFTimeInterval?
    }

    private enum PauseReason: Hashable {
        case background
        case longPress
        case transition
    }

    private enum PanMode {
        case idle
        case pending
        case vertical
        case horizontal
    }

    private enum GroupDirection {
        case forward
        case backward
    }

    private enum CubeHingeEdge {
        case leading
        case trailing
    }

    private static let defaultImageDurationMs: Int64 = 5_000
    private let swipeDismissThreshold: CGFloat = 120
    private let groupSwipeThreshold: CGFloat = 56
    private let gestureThreshold: CGFloat = 10
    private let cubePerspectiveDistance: CGFloat = 900
    private let cubeShadeMaxAlpha: CGFloat = 0.22
    private let cubeRotationRadians: CGFloat = .pi / 2

    private var interactiveGroupSwipeCompletionThreshold: CGFloat {
        groupSwipeThreshold / max(1, stageSurface.bounds.width)
    }
}

private final class ViewerStageView: UIView {
    let mediaHost = UIView()
    let topChrome = UIStackView()
    let progressStack = UIStackView()
    var progressSegments: [ProgressSegmentView] = []
    let avatarImageView = UIImageView()
    let avatarRing = GradientRingView(
        startColor: UIColor(openStoryHex: "#F59E0B"),
        endColor: UIColor(openStoryHex: "#8B5CF6"),
        strokeWidth: 2.5
    )
    let titleLabel = UILabel()
    let soundButton = UIButton(type: .system)
    let closeButton = UIButton(type: .system)
    let ctaButton = UIButton(type: .system)
    let transitionShade = UIView()

    override init(frame: CGRect) {
        super.init(frame: frame)
        buildUI()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        nil
    }

    private func buildUI() {
        backgroundColor = .black
        translatesAutoresizingMaskIntoConstraints = false
        layer.masksToBounds = false

        mediaHost.translatesAutoresizingMaskIntoConstraints = false
        mediaHost.backgroundColor = UIColor(openStoryHex: "#050505")
        mediaHost.clipsToBounds = true

        let topScrim = LinearGradientView(
            colors: [UIColor.black.withAlphaComponent(0.92), UIColor.clear]
        )
        topScrim.translatesAutoresizingMaskIntoConstraints = false

        let bottomScrim = LinearGradientView(
            colors: [UIColor.clear, UIColor.black.withAlphaComponent(0.95)]
        )
        bottomScrim.translatesAutoresizingMaskIntoConstraints = false

        progressStack.translatesAutoresizingMaskIntoConstraints = false
        progressStack.axis = .horizontal
        progressStack.alignment = .fill
        progressStack.spacing = 3
        progressStack.distribution = .fillEqually

        avatarImageView.translatesAutoresizingMaskIntoConstraints = false
        avatarImageView.contentMode = .scaleAspectFill
        avatarImageView.clipsToBounds = true
        avatarImageView.layer.cornerRadius = 16
        avatarImageView.backgroundColor = UIColor(white: 0.15, alpha: 1)

        avatarRing.translatesAutoresizingMaskIntoConstraints = false

        let avatarWrapper = UIView()
        avatarWrapper.translatesAutoresizingMaskIntoConstraints = false
        avatarWrapper.addSubview(avatarRing)
        avatarWrapper.addSubview(avatarImageView)

        NSLayoutConstraint.activate([
            avatarWrapper.widthAnchor.constraint(equalToConstant: 40),
            avatarWrapper.heightAnchor.constraint(equalToConstant: 40),
            avatarRing.topAnchor.constraint(equalTo: avatarWrapper.topAnchor),
            avatarRing.leadingAnchor.constraint(equalTo: avatarWrapper.leadingAnchor),
            avatarRing.trailingAnchor.constraint(equalTo: avatarWrapper.trailingAnchor),
            avatarRing.bottomAnchor.constraint(equalTo: avatarWrapper.bottomAnchor),
            avatarImageView.topAnchor.constraint(equalTo: avatarWrapper.topAnchor, constant: 4),
            avatarImageView.leadingAnchor.constraint(equalTo: avatarWrapper.leadingAnchor, constant: 4),
            avatarImageView.trailingAnchor.constraint(equalTo: avatarWrapper.trailingAnchor, constant: -4),
            avatarImageView.bottomAnchor.constraint(equalTo: avatarWrapper.bottomAnchor, constant: -4),
        ])

        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.font = .systemFont(ofSize: 15, weight: .semibold)
        titleLabel.textColor = .white
        titleLabel.numberOfLines = 1

        configureIconButton(soundButton, symbol: "speaker.slash.fill")
        configureIconButton(closeButton, symbol: "xmark")

        let headerLeft = UIStackView(arrangedSubviews: [avatarWrapper, titleLabel])
        headerLeft.translatesAutoresizingMaskIntoConstraints = false
        headerLeft.axis = .horizontal
        headerLeft.alignment = .center
        headerLeft.spacing = 10

        let headerRight = UIStackView(arrangedSubviews: [soundButton, closeButton])
        headerRight.translatesAutoresizingMaskIntoConstraints = false
        headerRight.axis = .horizontal
        headerRight.alignment = .center
        headerRight.spacing = 6

        let headerRow = UIStackView(arrangedSubviews: [headerLeft, headerRight])
        headerRow.translatesAutoresizingMaskIntoConstraints = false
        headerRow.axis = .horizontal
        headerRow.alignment = .center
        headerRow.distribution = .equalSpacing

        let headerChrome = UIView()
        headerChrome.translatesAutoresizingMaskIntoConstraints = false
        headerChrome.addSubview(headerRow)

        topChrome.translatesAutoresizingMaskIntoConstraints = false
        topChrome.addArrangedSubview(progressStack)
        topChrome.addArrangedSubview(headerChrome)
        topChrome.axis = .vertical
        topChrome.spacing = 6
        topChrome.isLayoutMarginsRelativeArrangement = true
        topChrome.layoutMargins = UIEdgeInsets(top: 0, left: 18, bottom: 0, right: 18)

        ctaButton.translatesAutoresizingMaskIntoConstraints = false
        ctaButton.configuration = .filled()
        ctaButton.configuration?.baseBackgroundColor = UIColor(openStoryHex: "#F7C948")
        ctaButton.configuration?.baseForegroundColor = .black
        ctaButton.configuration?.cornerStyle = .capsule
        ctaButton.configuration?.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 28, bottom: 12, trailing: 28)
        ctaButton.titleLabel?.font = .systemFont(ofSize: 16, weight: .bold)
        ctaButton.isHidden = true

        transitionShade.translatesAutoresizingMaskIntoConstraints = false
        transitionShade.backgroundColor = .black
        transitionShade.alpha = 0

        addSubview(mediaHost)
        addSubview(topScrim)
        addSubview(bottomScrim)
        addSubview(transitionShade)
        addSubview(topChrome)
        addSubview(ctaButton)

        NSLayoutConstraint.activate([
            mediaHost.topAnchor.constraint(equalTo: topAnchor),
            mediaHost.leadingAnchor.constraint(equalTo: leadingAnchor),
            mediaHost.trailingAnchor.constraint(equalTo: trailingAnchor),
            mediaHost.bottomAnchor.constraint(equalTo: bottomAnchor),

            topScrim.topAnchor.constraint(equalTo: topAnchor),
            topScrim.leadingAnchor.constraint(equalTo: leadingAnchor),
            topScrim.trailingAnchor.constraint(equalTo: trailingAnchor),
            topScrim.heightAnchor.constraint(equalToConstant: 212),

            bottomScrim.leadingAnchor.constraint(equalTo: leadingAnchor),
            bottomScrim.trailingAnchor.constraint(equalTo: trailingAnchor),
            bottomScrim.bottomAnchor.constraint(equalTo: bottomAnchor),
            bottomScrim.heightAnchor.constraint(equalToConstant: 228),

            transitionShade.topAnchor.constraint(equalTo: topAnchor),
            transitionShade.leadingAnchor.constraint(equalTo: leadingAnchor),
            transitionShade.trailingAnchor.constraint(equalTo: trailingAnchor),
            transitionShade.bottomAnchor.constraint(equalTo: bottomAnchor),

            topChrome.topAnchor.constraint(equalTo: safeAreaLayoutGuide.topAnchor),
            topChrome.leadingAnchor.constraint(equalTo: leadingAnchor),
            topChrome.trailingAnchor.constraint(equalTo: trailingAnchor),

            headerRow.topAnchor.constraint(equalTo: headerChrome.topAnchor, constant: 6),
            headerRow.leadingAnchor.constraint(equalTo: headerChrome.leadingAnchor, constant: 12),
            headerRow.trailingAnchor.constraint(equalTo: headerChrome.trailingAnchor, constant: -12),
            headerRow.bottomAnchor.constraint(equalTo: headerChrome.bottomAnchor, constant: -6),

            headerLeft.widthAnchor.constraint(greaterThanOrEqualTo: headerRight.widthAnchor),

            ctaButton.centerXAnchor.constraint(equalTo: centerXAnchor),
            ctaButton.bottomAnchor.constraint(equalTo: safeAreaLayoutGuide.bottomAnchor, constant: -24),
        ])
    }

    private func configureIconButton(
        _ button: UIButton,
        symbol: String
    ) {
        button.translatesAutoresizingMaskIntoConstraints = false
        button.configuration = .plain()
        button.configuration?.baseForegroundColor = .white
        button.configuration?.background.backgroundColor = UIColor.white.withAlphaComponent(0.08)
        button.configuration?.background.strokeColor = UIColor.white.withAlphaComponent(0.1)
        button.configuration?.background.strokeWidth = 0.75
        button.configuration?.background.cornerRadius = 17
        button.configuration?.contentInsets = NSDirectionalEdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8)
        button.setImage(UIImage(systemName: symbol), for: .normal)
        NSLayoutConstraint.activate([
            button.widthAnchor.constraint(equalToConstant: 34),
            button.heightAnchor.constraint(equalToConstant: 34),
        ])
    }
}

private final class ProgressSegmentView: UIView {
    private let trackView = UIView()
    private let fillView = UIView()

    var progress: CGFloat = 0 {
        didSet { setNeedsLayout() }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        translatesAutoresizingMaskIntoConstraints = false
        trackView.translatesAutoresizingMaskIntoConstraints = false
        trackView.backgroundColor = UIColor.white.withAlphaComponent(0.35)
        trackView.clipsToBounds = true
        fillView.backgroundColor = .white
        addSubview(trackView)
        trackView.addSubview(fillView)

        NSLayoutConstraint.activate([
            trackView.topAnchor.constraint(equalTo: topAnchor),
            trackView.leadingAnchor.constraint(equalTo: leadingAnchor),
            trackView.trailingAnchor.constraint(equalTo: trailingAnchor),
            trackView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        nil
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        let h = trackView.bounds.height
        trackView.layer.cornerRadius = h / 2
        fillView.layer.cornerRadius = h / 2
        let width = trackView.bounds.width * min(1, max(0, progress))
        fillView.frame = CGRect(x: 0, y: 0, width: width, height: h)
    }
}

private final class PlayerSurfaceView: UIView {
    override class var layerClass: AnyClass {
        AVPlayerLayer.self
    }

    var playerLayer: AVPlayerLayer {
        layer as! AVPlayerLayer
    }

    var player: AVPlayer? {
        get { playerLayer.player }
        set { playerLayer.player = newValue }
    }
}

private final class LinearGradientView: UIView {
    private let gradientLayer = CAGradientLayer()

    init(colors: [UIColor]) {
        super.init(frame: .zero)
        isUserInteractionEnabled = false
        gradientLayer.colors = colors.map(\.cgColor)
        gradientLayer.startPoint = CGPoint(x: 0.5, y: 0)
        gradientLayer.endPoint = CGPoint(x: 0.5, y: 1)
        layer.addSublayer(gradientLayer)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        nil
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        gradientLayer.frame = bounds
    }
}

private extension UIView {
    func openStoryPresentationViewController() -> UIViewController? {
        if let rootViewController = window?.rootViewController {
            return rootViewController.openStoryVisibleLeafViewController()
        }

        var responder: UIResponder? = self
        while let current = responder {
            if let viewController = current as? UIViewController {
                return viewController.openStoryVisibleLeafViewController()
            }
            responder = current.next
        }
        return nil
    }
}

private extension UIViewController {
    func openStoryVisibleLeafViewController() -> UIViewController {
        if let presentedViewController {
            return presentedViewController.openStoryVisibleLeafViewController()
        }

        if let navigationController = self as? UINavigationController {
            return navigationController.visibleViewController?.openStoryVisibleLeafViewController() ?? navigationController
        }

        if let tabBarController = self as? UITabBarController {
            return tabBarController.selectedViewController?.openStoryVisibleLeafViewController() ?? tabBarController
        }

        return self
    }
}

private extension Collection {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
#endif
