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
    private var transitionAnimator: UIViewPropertyAnimator?
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
    }

    private func renderMedia(_ story: SdkFeedStoryPayload) {
        cleanupPlayback()
        activeStage.mediaHost.subviews.forEach { $0.removeFromSuperview() }
        imageProgressState = StoryPlaybackProgressState.started(Self.defaultImageDurationMs)
        storyPlaybackStartedAtMs = 0

        addMediaBackdrop(
            to: activeStage.mediaHost,
            imageURL: story.posterAsset?.url ?? story.asset.url
        )

        if story.mediaType == "video", let url = URL(string: story.asset.url) {
            let player = AVPlayer(url: url)
            player.isMuted = isMuted
            let playerSurfaceView = PlayerSurfaceView()
            playerSurfaceView.translatesAutoresizingMaskIntoConstraints = false
            playerSurfaceView.player = player
            playerSurfaceView.playerLayer.videoGravity = .resizeAspect
            activeStage.mediaHost.addSubview(playerSurfaceView)
            NSLayoutConstraint.activate([
                playerSurfaceView.topAnchor.constraint(equalTo: activeStage.mediaHost.topAnchor),
                playerSurfaceView.leadingAnchor.constraint(equalTo: activeStage.mediaHost.leadingAnchor),
                playerSurfaceView.trailingAnchor.constraint(equalTo: activeStage.mediaHost.trailingAnchor),
                playerSurfaceView.bottomAnchor.constraint(equalTo: activeStage.mediaHost.bottomAnchor),
            ])

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

        let imageView = UIImageView()
        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.contentMode = .scaleAspectFit
        activeStage.mediaHost.addSubview(imageView)
        NSLayoutConstraint.activate([
            imageView.topAnchor.constraint(equalTo: activeStage.mediaHost.topAnchor),
            imageView.leadingAnchor.constraint(equalTo: activeStage.mediaHost.leadingAnchor),
            imageView.trailingAnchor.constraint(equalTo: activeStage.mediaHost.trailingAnchor),
            imageView.bottomAnchor.constraint(equalTo: activeStage.mediaHost.bottomAnchor),
        ])
        RemoteImageLoader.loadImage(from: story.asset.url, into: imageView)

        activeStage.soundButton.isHidden = true
        imageProgressState = StoryPlaybackProgressState.started(story.imageDurationMs ?? Self.defaultImageDurationMs)
        startImageAutoAdvanceIfEligible()
    }

    private func renderPreviewMedia(
        stage: ViewerStageView,
        story: SdkFeedStoryPayload
    ) {
        stage.mediaHost.subviews.forEach { $0.removeFromSuperview() }
        addMediaBackdrop(
            to: stage.mediaHost,
            imageURL: story.posterAsset?.url ?? story.asset.url
        )

        let imageView = UIImageView()
        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.contentMode = .scaleAspectFit
        stage.mediaHost.addSubview(imageView)
        NSLayoutConstraint.activate([
            imageView.topAnchor.constraint(equalTo: stage.mediaHost.topAnchor),
            imageView.leadingAnchor.constraint(equalTo: stage.mediaHost.leadingAnchor),
            imageView.trailingAnchor.constraint(equalTo: stage.mediaHost.trailingAnchor),
            imageView.bottomAnchor.constraint(equalTo: stage.mediaHost.bottomAnchor),
        ])
        RemoteImageLoader.loadImage(from: story.posterAsset?.url ?? story.asset.url, into: imageView)
    }

    private func bindCTA(
        stage: ViewerStageView,
        group: SdkFeedGroupPayload,
        story: SdkFeedStoryPayload,
        interactive: Bool
    ) {
        guard let cta = story.cta else {
            stage.ctaButton.isHidden = true
            if stage === activeStage {
                currentCTAContext = nil
            }
            return
        }

        stage.ctaButton.isHidden = false
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

        transitionAnimator?.stopAnimation(true)
        isTransitionRunning = true
        addPauseReason(.transition)
        inactiveStage.isHidden = false
        renderPreviewStage(inactiveStage, groupIndex: targetGroupIndex, storyIndex: targetStoryIndex)

        currentTransition = GroupTransitionState(
            sourceStage: activeStage,
            targetStage: inactiveStage,
            targetGroupIndex: targetGroupIndex,
            targetStoryIndex: targetStoryIndex,
            direction: direction,
            progress: 0
        )
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

        transitionAnimator?.stopAnimation(true)
        let startProgress = transition.progress
        let duration = max(0.18, 0.42 * abs(targetProgress - startProgress))
        let animator = UIViewPropertyAnimator(duration: duration, dampingRatio: 0.9) { [weak self] in
            self?.applyGroupTransitionProgress(targetProgress)
        }
        animator.addCompletion { [weak self] position in
            guard let self else { return }
            self.transitionAnimator = nil
            if position == .end, abs(targetProgress - 1) < 0.0001 {
                self.finishCurrentTransition()
            } else {
                self.cancelCurrentTransition()
            }
        }
        transitionAnimator = animator
        animator.startAnimation()
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

        applyCubeTransform(
            stage: transition.sourceStage,
            position: transition.direction == .forward ? -clamped : clamped
        )
        applyCubeTransform(
            stage: transition.targetStage,
            position: transition.direction == .forward ? 1 - clamped : clamped - 1
        )

        if clamped < 0.5 {
            stageSurface.bringSubviewToFront(transition.sourceStage)
        } else {
            stageSurface.bringSubviewToFront(transition.targetStage)
        }
    }

    private func applyCubeTransform(
        stage: ViewerStageView,
        position: CGFloat
    ) {
        let magnitude = abs(position)
        stage.layer.anchorPoint = CGPoint(x: position < 0 ? 1 : 0, y: 0.5)
        stage.layer.position = CGPoint(
            x: position < 0 ? stage.bounds.width : 0,
            y: stage.bounds.midY
        )

        var transform = CATransform3DIdentity
        transform.m34 = -1 / 900
        transform = CATransform3DTranslate(transform, stage.bounds.width * position * 0.82, 0, -72 * magnitude)
        transform = CATransform3DRotate(transform, cubeRotationRadians * position, 0, 1, 0)
        transform = CATransform3DScale(transform, 1 - (0.08 * magnitude), 1 - (0.08 * magnitude), 1)
        stage.layer.transform = transform
        stage.alpha = max(0.78, 1 - (magnitude * 0.22))
        stage.layer.shadowOpacity = Float(min(0.24, magnitude * 0.24))
        stage.layer.shadowRadius = 34
        stage.layer.shadowOffset = CGSize(width: -14 * position, height: 0)
        stage.transitionShade.alpha = min(cubeShadeMaxAlpha, magnitude * cubeShadeMaxAlpha)
    }

    private func finishCurrentTransition() {
        guard let transition = currentTransition else {
            return
        }

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
        renderCurrentStory()
    }

    private func cancelCurrentTransition() {
        guard let transition = currentTransition else {
            return
        }

        resetStageTransform(transition.sourceStage)
        resetStageTransform(transition.targetStage)
        transition.targetStage.isHidden = true
        currentTransition = nil
        isTransitionRunning = false
        removePauseReason(.transition)
    }

    private func resetStageTransform(_ stage: ViewerStageView) {
        stage.layer.anchorPoint = CGPoint(x: 0.5, y: 0.5)
        stage.layer.position = CGPoint(x: stage.bounds.midX, y: stage.bounds.midY)
        stage.layer.transform = CATransform3DIdentity
        stage.alpha = 1
        stage.layer.shadowOpacity = 0
        stage.transitionShade.alpha = 0
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
        if pauseReasons.isEmpty {
            resumeCurrentStory()
        } else {
            pauseCurrentStory()
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
        if point.x < stageSurface.bounds.midX {
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

    private static let defaultImageDurationMs: Int64 = 5_000
    private let swipeDismissThreshold: CGFloat = 120
    private let groupSwipeThreshold: CGFloat = 56
    private let gestureThreshold: CGFloat = 10
    private let cubeShadeMaxAlpha: CGFloat = 0.22
    private let cubeRotationRadians: CGFloat = .pi / 2.05

    private var interactiveGroupSwipeCompletionThreshold: CGFloat {
        groupSwipeThreshold / max(1, stageSurface.bounds.width)
    }
}

private final class ViewerStageView: UIView {
    let mediaHost = UIView()
    let progressStack = UIStackView()
    var progressSegments: [ProgressSegmentView] = []
    let avatarImageView = UIImageView()
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
            colors: [UIColor.black.withAlphaComponent(0.85), UIColor.black.withAlphaComponent(0.08)]
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
        avatarImageView.layer.cornerRadius = 18
        avatarImageView.backgroundColor = UIColor(white: 0.15, alpha: 1)

        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.font = .systemFont(ofSize: 15, weight: .semibold)
        titleLabel.textColor = .white
        titleLabel.numberOfLines = 1

        configureIconButton(soundButton, symbol: "speaker.slash.fill")
        configureIconButton(closeButton, symbol: "xmark")

        let headerLeft = UIStackView(arrangedSubviews: [avatarImageView, titleLabel])
        headerLeft.translatesAutoresizingMaskIntoConstraints = false
        headerLeft.axis = .horizontal
        headerLeft.alignment = .center
        headerLeft.spacing = 10

        let headerRight = UIStackView(arrangedSubviews: [soundButton, closeButton])
        headerRight.translatesAutoresizingMaskIntoConstraints = false
        headerRight.axis = .horizontal
        headerRight.alignment = .center
        headerRight.spacing = 8

        let headerRow = UIStackView(arrangedSubviews: [headerLeft, headerRight])
        headerRow.translatesAutoresizingMaskIntoConstraints = false
        headerRow.axis = .horizontal
        headerRow.alignment = .center
        headerRow.distribution = .equalSpacing

        let headerChrome = UIView()
        headerChrome.translatesAutoresizingMaskIntoConstraints = false
        headerChrome.backgroundColor = UIColor.black.withAlphaComponent(0.22)
        headerChrome.layer.cornerRadius = 22
        headerChrome.layer.cornerCurve = .continuous
        headerChrome.layer.borderWidth = 1
        headerChrome.layer.borderColor = UIColor.white.withAlphaComponent(0.08).cgColor
        headerChrome.addSubview(headerRow)

        let topChrome = UIStackView(arrangedSubviews: [progressStack, headerChrome])
        topChrome.translatesAutoresizingMaskIntoConstraints = false
        topChrome.axis = .vertical
        topChrome.spacing = 12
        topChrome.isLayoutMarginsRelativeArrangement = true
        topChrome.layoutMargins = UIEdgeInsets(top: 8, left: 18, bottom: 0, right: 18)

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

            topChrome.topAnchor.constraint(equalTo: safeAreaLayoutGuide.topAnchor, constant: 6),
            topChrome.leadingAnchor.constraint(equalTo: leadingAnchor),
            topChrome.trailingAnchor.constraint(equalTo: trailingAnchor),

            headerRow.topAnchor.constraint(equalTo: headerChrome.topAnchor, constant: 10),
            headerRow.leadingAnchor.constraint(equalTo: headerChrome.leadingAnchor, constant: 12),
            headerRow.trailingAnchor.constraint(equalTo: headerChrome.trailingAnchor, constant: -12),
            headerRow.bottomAnchor.constraint(equalTo: headerChrome.bottomAnchor, constant: -10),

            avatarImageView.widthAnchor.constraint(equalToConstant: 36),
            avatarImageView.heightAnchor.constraint(equalToConstant: 36),

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
        button.configuration?.background.cornerRadius = 19
        button.configuration?.contentInsets = NSDirectionalEdgeInsets(top: 10, leading: 10, bottom: 10, trailing: 10)
        button.setImage(UIImage(systemName: symbol), for: .normal)
        NSLayoutConstraint.activate([
            button.widthAnchor.constraint(equalToConstant: 38),
            button.heightAnchor.constraint(equalToConstant: 38),
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
        trackView.layer.cornerRadius = 999
        fillView.translatesAutoresizingMaskIntoConstraints = false
        fillView.backgroundColor = .white
        fillView.layer.cornerRadius = 999
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
        let width = trackView.bounds.width * min(1, max(0, progress))
        fillView.frame = CGRect(x: 0, y: 0, width: width, height: trackView.bounds.height)
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
