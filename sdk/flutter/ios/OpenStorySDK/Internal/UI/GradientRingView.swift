#if canImport(UIKit)
import UIKit

internal final class GradientRingView: UIView {
    private let gradientLayer = CAGradientLayer()
    private let maskLayer = CAShapeLayer()
    private let strokeWidth: CGFloat

    var startColor: UIColor {
        didSet { updateColors() }
    }

    var endColor: UIColor {
        didSet { updateColors() }
    }

    init(
        startColor: UIColor,
        endColor: UIColor,
        strokeWidth: CGFloat
    ) {
        self.startColor = startColor
        self.endColor = endColor
        self.strokeWidth = strokeWidth
        super.init(frame: .zero)
        isUserInteractionEnabled = false
        layer.addSublayer(gradientLayer)
        gradientLayer.mask = maskLayer
        gradientLayer.startPoint = CGPoint(x: 0, y: 0)
        gradientLayer.endPoint = CGPoint(x: 1, y: 1)
        updateColors()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        nil
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        gradientLayer.frame = bounds

        let outerPath = UIBezierPath(ovalIn: bounds)
        let innerRect = bounds.insetBy(dx: strokeWidth, dy: strokeWidth)
        let innerPath = UIBezierPath(ovalIn: innerRect)
        outerPath.append(innerPath)

        maskLayer.frame = bounds
        maskLayer.path = outerPath.cgPath
        maskLayer.fillRule = .evenOdd
    }

    private func updateColors() {
        gradientLayer.colors = [startColor.cgColor, endColor.cgColor]
    }
}
#endif
