import UIKit

enum Theme {
    // MARK: - Backgrounds

    static let background = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.10, green: 0.08, blue: 0.07, alpha: 1)
            : UIColor(red: 0.98, green: 0.96, blue: 0.93, alpha: 1)
    }

    static let cardBackground = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.16, green: 0.13, blue: 0.11, alpha: 1)
            : UIColor(white: 1, alpha: 0.92)
    }

    // MARK: - Text

    static let primaryText = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.95, green: 0.91, blue: 0.87, alpha: 1)
            : UIColor(red: 0.17, green: 0.10, blue: 0.07, alpha: 1)
    }

    static let secondaryText = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.88, green: 0.83, blue: 0.78, alpha: 1)
            : UIColor(red: 0.22, green: 0.13, blue: 0.08, alpha: 1)
    }

    static let tertiaryText = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.68, green: 0.58, blue: 0.50, alpha: 1)
            : UIColor(red: 0.45, green: 0.28, blue: 0.18, alpha: 1)
    }

    static let mutedText = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.52, green: 0.47, blue: 0.43, alpha: 1)
            : UIColor(red: 0.56, green: 0.51, blue: 0.46, alpha: 1)
    }

    static let detailKeyText = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.62, green: 0.52, blue: 0.44, alpha: 1)
            : UIColor(red: 0.58, green: 0.42, blue: 0.30, alpha: 1)
    }

    static let detailValueText = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.82, green: 0.76, blue: 0.70, alpha: 1)
            : UIColor(red: 0.22, green: 0.16, blue: 0.12, alpha: 1)
    }

    static let statusText = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.78, green: 0.65, blue: 0.55, alpha: 1)
            : UIColor(red: 0.36, green: 0.21, blue: 0.11, alpha: 1)
    }

    static let eventLogText = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.72, green: 0.65, blue: 0.60, alpha: 1)
            : UIColor(red: 0.27, green: 0.21, blue: 0.18, alpha: 1)
    }

    // MARK: - Accents

    static let accent = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.90, green: 0.50, blue: 0.25, alpha: 1)
            : UIColor(red: 0.84, green: 0.41, blue: 0.18, alpha: 1)
    }

    static let navBarTint = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.90, green: 0.50, blue: 0.25, alpha: 1)
            : UIColor(red: 0.20, green: 0.12, blue: 0.07, alpha: 1)
    }

    static let tabBarUnselected = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.50, green: 0.45, blue: 0.42, alpha: 1)
            : UIColor(white: 0.44, alpha: 1)
    }

    // MARK: - On-dark-surface (same in both modes)

    static let heroIconTint = UIColor(red: 1, green: 0.84, blue: 0.46, alpha: 1)
    static let heroTitle = UIColor.white
    static let heroSubtitle = UIColor(white: 1, alpha: 0.76)

    // MARK: - Gradient helpers (CAGradientLayer needs resolved CGColor)

    static func heroGradientColors(for traits: UITraitCollection) -> [CGColor] {
        if traits.userInterfaceStyle == .dark {
            return [
                UIColor(red: 0.12, green: 0.08, blue: 0.05, alpha: 1).cgColor,
                UIColor(red: 0.40, green: 0.20, blue: 0.10, alpha: 1).cgColor,
            ]
        }
        return [
            UIColor(red: 0.20, green: 0.12, blue: 0.07, alpha: 1).cgColor,
            UIColor(red: 0.52, green: 0.24, blue: 0.12, alpha: 1).cgColor,
        ]
    }

    static let heroSolidBackground = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.12, green: 0.08, blue: 0.05, alpha: 1)
            : UIColor(red: 0.20, green: 0.12, blue: 0.07, alpha: 1)
    }

    static func topSurfaceGradientColors(for traits: UITraitCollection) -> [CGColor] {
        if traits.userInterfaceStyle == .dark {
            return [
                UIColor(red: 0.16, green: 0.12, blue: 0.09, alpha: 1).cgColor,
                UIColor(red: 0.12, green: 0.09, blue: 0.07, alpha: 1).cgColor,
            ]
        }
        return [
            UIColor(red: 0.99, green: 0.96, blue: 0.91, alpha: 1).cgColor,
            UIColor(red: 0.96, green: 0.89, blue: 0.80, alpha: 1).cgColor,
        ]
    }

    // MARK: - Shadow

    static func cardShadowOpacity(for traits: UITraitCollection) -> Float {
        traits.userInterfaceStyle == .dark ? 0.0 : 0.05
    }
}
