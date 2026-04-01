import SwiftUI

enum AppTheme: String, CaseIterable, Identifiable {
    case blue
    case gold
    case ocean
    case forest
    case sunset
    case lavender
    case light

    var id: String { rawValue }
    var displayName: String { rawValue.capitalized }

    var palette: ThemePalette {
        switch self {
        case .blue: return .blue
        case .gold: return .gold
        case .ocean: return .ocean
        case .forest: return .forest
        case .sunset: return .sunset
        case .lavender: return .lavender
        case .light: return .light
        }
    }
}

extension ThemePalette {
    static let blue = ThemePalette(
        background: hsl(222.2, 84, 4.9),
        foreground: hsl(210, 40, 98),
        card: hsl(222.2, 84, 4.9),
        cardForeground: hsl(210, 40, 98),
        primary: hsl(217.2, 91.2, 59.8),
        primaryForeground: hsl(222.2, 47.4, 11.2),
        secondary: hsl(217.2, 32.6, 17.5),
        secondaryForeground: hsl(210, 40, 98),
        muted: hsl(217.2, 32.6, 17.5),
        mutedForeground: hsl(215, 20.2, 65.1),
        accent: hsl(217.2, 32.6, 17.5),
        accentForeground: hsl(210, 40, 98),
        destructive: hsl(0, 62.8, 30.6),
        destructiveForeground: hsl(210, 40, 98),
        border: hsl(217.2, 25, 24),
        ring: hsl(224.3, 76.3, 48)
    )

    static let gold = ThemePalette(
        background: hsl(0, 0, 4),
        foreground: hsl(0, 0, 98),
        card: hsl(0, 0, 4),
        cardForeground: hsl(0, 0, 98),
        primary: hsl(37, 36, 63),
        primaryForeground: hsl(0, 0, 4),
        secondary: hsl(0, 0, 10),
        secondaryForeground: hsl(0, 0, 98),
        muted: hsl(0, 0, 10),
        mutedForeground: hsl(0, 0, 64),
        accent: hsl(0, 0, 10),
        accentForeground: hsl(0, 0, 98),
        destructive: hsl(0, 62.8, 30.6),
        destructiveForeground: hsl(0, 0, 98),
        border: hsl(0, 0, 22),
        ring: hsl(37, 36, 63)
    )

    static let ocean = ThemePalette(
        background: hsl(180, 20, 4),
        foreground: hsl(180, 10, 98),
        card: hsl(180, 20, 4),
        cardForeground: hsl(180, 10, 98),
        primary: hsl(168, 76, 42),
        primaryForeground: hsl(180, 20, 4),
        secondary: hsl(180, 15, 12),
        secondaryForeground: hsl(180, 10, 98),
        muted: hsl(180, 15, 12),
        mutedForeground: hsl(180, 8, 64),
        accent: hsl(180, 15, 12),
        accentForeground: hsl(180, 10, 98),
        destructive: hsl(0, 62.8, 30.6),
        destructiveForeground: hsl(180, 10, 98),
        border: hsl(180, 12, 24),
        ring: hsl(168, 76, 42)
    )

    static let forest = ThemePalette(
        background: hsl(140, 20, 4),
        foreground: hsl(140, 10, 98),
        card: hsl(140, 20, 4),
        cardForeground: hsl(140, 10, 98),
        primary: hsl(142, 71, 45),
        primaryForeground: hsl(140, 20, 4),
        secondary: hsl(140, 15, 12),
        secondaryForeground: hsl(140, 10, 98),
        muted: hsl(140, 15, 12),
        mutedForeground: hsl(140, 8, 64),
        accent: hsl(140, 15, 12),
        accentForeground: hsl(140, 10, 98),
        destructive: hsl(0, 62.8, 30.6),
        destructiveForeground: hsl(140, 10, 98),
        border: hsl(140, 12, 24),
        ring: hsl(142, 71, 45)
    )

    static let sunset = ThemePalette(
        background: hsl(20, 20, 4),
        foreground: hsl(20, 10, 98),
        card: hsl(20, 20, 4),
        cardForeground: hsl(20, 10, 98),
        primary: hsl(25, 95, 53),
        primaryForeground: hsl(20, 20, 4),
        secondary: hsl(20, 15, 12),
        secondaryForeground: hsl(20, 10, 98),
        muted: hsl(20, 15, 12),
        mutedForeground: hsl(20, 8, 64),
        accent: hsl(20, 15, 12),
        accentForeground: hsl(20, 10, 98),
        destructive: hsl(0, 62.8, 30.6),
        destructiveForeground: hsl(20, 10, 98),
        border: hsl(20, 12, 24),
        ring: hsl(25, 95, 53)
    )

    static let lavender = ThemePalette(
        background: hsl(270, 20, 4),
        foreground: hsl(270, 10, 98),
        card: hsl(270, 20, 4),
        cardForeground: hsl(270, 10, 98),
        primary: hsl(271, 91, 65),
        primaryForeground: hsl(270, 20, 4),
        secondary: hsl(270, 15, 12),
        secondaryForeground: hsl(270, 10, 98),
        muted: hsl(270, 15, 12),
        mutedForeground: hsl(270, 8, 64),
        accent: hsl(270, 15, 12),
        accentForeground: hsl(270, 10, 98),
        destructive: hsl(0, 62.8, 30.6),
        destructiveForeground: hsl(270, 10, 98),
        border: hsl(270, 12, 24),
        ring: hsl(271, 91, 65)
    )

    static let light = ThemePalette(
        background: .white,
        foreground: hsl(222.2, 84, 4.9),
        card: .white,
        cardForeground: hsl(222.2, 84, 4.9),
        primary: hsl(221.2, 83.2, 53.3),
        primaryForeground: .white,
        secondary: hsl(210, 40, 96.1),
        secondaryForeground: hsl(222.2, 47.4, 11.2),
        muted: hsl(210, 40, 96.1),
        mutedForeground: hsl(215.4, 16.3, 46.9),
        accent: hsl(210, 40, 96.1),
        accentForeground: hsl(222.2, 47.4, 11.2),
        destructive: hsl(0, 84.2, 60.2),
        destructiveForeground: .white,
        border: hsl(214.3, 31.8, 91.4),
        ring: hsl(221.2, 83.2, 53.3)
    )
}
