import UIKit

enum Theme {
    // MARK: - Backgrounds

    static let background = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.02, green: 0.02, blue: 0.02, alpha: 1)
            : UIColor(red: 0.04, green: 0.04, blue: 0.05, alpha: 1)
    }

    static let cardBackground = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.08, green: 0.08, blue: 0.09, alpha: 1)
            : UIColor(red: 0.10, green: 0.10, blue: 0.11, alpha: 1)
    }

    static let barBackground = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.04, green: 0.04, blue: 0.05, alpha: 1)
            : UIColor(red: 0.06, green: 0.06, blue: 0.07, alpha: 1)
    }

    static let separator = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(white: 1, alpha: 0.10)
            : UIColor(white: 1, alpha: 0.12)
    }

    // MARK: - Text

    static let primaryText = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(white: 0.97, alpha: 1)
            : UIColor(white: 0.95, alpha: 1)
    }

    static let secondaryText = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(white: 0.86, alpha: 1)
            : UIColor(white: 0.84, alpha: 1)
    }

    static let tertiaryText = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(white: 0.64, alpha: 1)
            : UIColor(white: 0.62, alpha: 1)
    }

    static let mutedText = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(white: 0.46, alpha: 1)
            : UIColor(white: 0.50, alpha: 1)
    }

    static let detailKeyText = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.35, green: 0.82, blue: 0.92, alpha: 1)
            : UIColor(red: 0.32, green: 0.78, blue: 0.90, alpha: 1)
    }

    static let detailValueText = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(white: 0.90, alpha: 1)
            : UIColor(white: 0.88, alpha: 1)
    }

    static let statusText = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.62, green: 0.95, blue: 0.76, alpha: 1)
            : UIColor(red: 0.50, green: 0.88, blue: 0.68, alpha: 1)
    }

    static let eventLogText = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(white: 0.70, alpha: 1)
            : UIColor(white: 0.68, alpha: 1)
    }

    // MARK: - Accents

    static let accent = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.23, green: 0.82, blue: 1.00, alpha: 1)
            : UIColor(red: 0.18, green: 0.76, blue: 0.96, alpha: 1)
    }

    static let navBarTint = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.23, green: 0.82, blue: 1.00, alpha: 1)
            : UIColor(red: 0.18, green: 0.76, blue: 0.96, alpha: 1)
    }

    static let tabBarUnselected = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(white: 0.48, alpha: 1)
            : UIColor(white: 0.52, alpha: 1)
    }

    // MARK: - On-dark-surface (same in both modes)

    static let heroIconTint = UIColor(red: 0.62, green: 0.95, blue: 0.76, alpha: 1)
    static let heroTitle = UIColor.white
    static let heroSubtitle = UIColor(white: 1, alpha: 0.70)

    // MARK: - Gradient helpers (CAGradientLayer needs resolved CGColor)

    static func heroGradientColors(for traits: UITraitCollection) -> [CGColor] {
        if traits.userInterfaceStyle == .dark {
            return [
                UIColor(red: 0.03, green: 0.03, blue: 0.04, alpha: 1).cgColor,
                UIColor(red: 0.11, green: 0.13, blue: 0.16, alpha: 1).cgColor,
            ]
        }
        return [
            UIColor(red: 0.05, green: 0.05, blue: 0.06, alpha: 1).cgColor,
            UIColor(red: 0.14, green: 0.15, blue: 0.18, alpha: 1).cgColor,
        ]
    }

    static let heroSolidBackground = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.04, green: 0.04, blue: 0.05, alpha: 1)
            : UIColor(red: 0.07, green: 0.07, blue: 0.08, alpha: 1)
    }

    static func topSurfaceGradientColors(for traits: UITraitCollection) -> [CGColor] {
        if traits.userInterfaceStyle == .dark {
            return [
                UIColor(red: 0.10, green: 0.10, blue: 0.11, alpha: 1).cgColor,
                UIColor(red: 0.05, green: 0.05, blue: 0.06, alpha: 1).cgColor,
            ]
        }
        return [
            UIColor(red: 0.12, green: 0.12, blue: 0.13, alpha: 1).cgColor,
            UIColor(red: 0.07, green: 0.07, blue: 0.08, alpha: 1).cgColor,
        ]
    }

    // MARK: - Shadow

    static func cardShadowOpacity(for traits: UITraitCollection) -> Float {
        traits.userInterfaceStyle == .dark ? 0.0 : 0.16
    }
}
