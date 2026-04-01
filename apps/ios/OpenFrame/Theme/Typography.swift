import SwiftUI

/// App-wide typography constants for consistent text styling.
enum Typography {
    // MARK: - Display
    static let largeTitle: Font = .largeTitle.weight(.bold)
    static let title: Font = .title.weight(.semibold)
    static let title2: Font = .title2.weight(.semibold)
    static let title3: Font = .title3.weight(.medium)

    // MARK: - Body
    static let headline: Font = .headline
    static let body: Font = .body
    static let callout: Font = .callout
    static let subheadline: Font = .subheadline
    static let footnote: Font = .footnote

    // MARK: - Small
    static let caption: Font = .caption
    static let caption2: Font = .caption2

    // MARK: - Monospaced
    static let code: Font = .system(.body, design: .monospaced)
    static let codeSmall: Font = .system(.caption, design: .monospaced)

    // MARK: - Weather/Dashboard numbers
    static func temperature(_ size: CGFloat = 56) -> Font {
        .system(size: size, weight: .bold, design: .rounded)
    }

    static func statValue(_ size: CGFloat = 20) -> Font {
        .system(size: size, weight: .semibold, design: .rounded)
    }
}
