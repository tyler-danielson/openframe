import SwiftUI

// MARK: - Theme Color Palette

struct ThemePalette {
    let background: Color
    let foreground: Color
    let card: Color
    let cardForeground: Color
    let primary: Color
    let primaryForeground: Color
    let secondary: Color
    let secondaryForeground: Color
    let muted: Color
    let mutedForeground: Color
    let accent: Color
    let accentForeground: Color
    let destructive: Color
    let destructiveForeground: Color
    let border: Color
    let ring: Color
}

// MARK: - HSL Helper

func hsl(_ h: Double, _ s: Double, _ l: Double) -> Color {
    let sNorm = s / 100.0
    let lNorm = l / 100.0
    let c = (1.0 - abs(2.0 * lNorm - 1.0)) * sNorm
    let x = c * (1.0 - abs(fmod(h / 60.0, 2.0) - 1.0))
    let m = lNorm - c / 2.0

    let (r, g, b): (Double, Double, Double)
    switch h {
    case 0..<60:    (r, g, b) = (c, x, 0)
    case 60..<120:  (r, g, b) = (x, c, 0)
    case 120..<180: (r, g, b) = (0, c, x)
    case 180..<240: (r, g, b) = (0, x, c)
    case 240..<300: (r, g, b) = (x, 0, c)
    default:        (r, g, b) = (c, 0, x)
    }

    return Color(red: r + m, green: g + m, blue: b + m)
}

// MARK: - Dark Palettes

let bluePalette = ThemePalette(
    background: hsl(222.2, 84, 4.9), foreground: hsl(210, 40, 98),
    card: hsl(222.2, 84, 4.9), cardForeground: hsl(210, 40, 98),
    primary: hsl(217.2, 91.2, 59.8), primaryForeground: hsl(222.2, 47.4, 11.2),
    secondary: hsl(217.2, 32.6, 17.5), secondaryForeground: hsl(210, 40, 98),
    muted: hsl(217.2, 32.6, 17.5), mutedForeground: hsl(215, 20.2, 65.1),
    accent: hsl(217.2, 32.6, 17.5), accentForeground: hsl(210, 40, 98),
    destructive: hsl(0, 62.8, 30.6), destructiveForeground: hsl(210, 40, 98),
    border: hsl(217.2, 25, 24), ring: hsl(224.3, 76.3, 48)
)

let goldPalette = ThemePalette(
    background: hsl(0, 0, 4), foreground: hsl(0, 0, 98),
    card: hsl(0, 0, 6), cardForeground: hsl(0, 0, 98),
    primary: hsl(37, 36, 63), primaryForeground: hsl(0, 0, 4),
    secondary: hsl(0, 0, 10), secondaryForeground: hsl(0, 0, 98),
    muted: hsl(0, 0, 12), mutedForeground: hsl(0, 0, 60),
    accent: hsl(0, 0, 10), accentForeground: hsl(0, 0, 98),
    destructive: hsl(0, 62.8, 30.6), destructiveForeground: hsl(210, 40, 98),
    border: hsl(0, 0, 22), ring: hsl(37, 36, 63)
)

let oceanPalette = ThemePalette(
    background: hsl(180, 20, 4), foreground: hsl(180, 10, 98),
    card: hsl(180, 15, 6), cardForeground: hsl(180, 10, 98),
    primary: hsl(168, 76, 42), primaryForeground: hsl(180, 20, 4),
    secondary: hsl(180, 15, 12), secondaryForeground: hsl(180, 10, 98),
    muted: hsl(180, 15, 14), mutedForeground: hsl(180, 10, 60),
    accent: hsl(180, 15, 12), accentForeground: hsl(180, 10, 98),
    destructive: hsl(0, 62.8, 30.6), destructiveForeground: hsl(210, 40, 98),
    border: hsl(180, 12, 24), ring: hsl(168, 76, 42)
)

let forestPalette = ThemePalette(
    background: hsl(140, 20, 4), foreground: hsl(140, 10, 98),
    card: hsl(140, 15, 6), cardForeground: hsl(140, 10, 98),
    primary: hsl(142, 71, 45), primaryForeground: hsl(140, 20, 4),
    secondary: hsl(140, 15, 12), secondaryForeground: hsl(140, 10, 98),
    muted: hsl(140, 15, 14), mutedForeground: hsl(140, 10, 60),
    accent: hsl(140, 15, 12), accentForeground: hsl(140, 10, 98),
    destructive: hsl(0, 62.8, 30.6), destructiveForeground: hsl(210, 40, 98),
    border: hsl(140, 12, 24), ring: hsl(142, 71, 45)
)

let sunsetPalette = ThemePalette(
    background: hsl(20, 20, 4), foreground: hsl(20, 10, 98),
    card: hsl(20, 15, 6), cardForeground: hsl(20, 10, 98),
    primary: hsl(25, 95, 53), primaryForeground: hsl(20, 20, 4),
    secondary: hsl(20, 15, 12), secondaryForeground: hsl(20, 10, 98),
    muted: hsl(20, 15, 14), mutedForeground: hsl(20, 10, 60),
    accent: hsl(20, 15, 12), accentForeground: hsl(20, 10, 98),
    destructive: hsl(0, 62.8, 30.6), destructiveForeground: hsl(210, 40, 98),
    border: hsl(20, 12, 24), ring: hsl(25, 95, 53)
)

let lavenderPalette = ThemePalette(
    background: hsl(270, 20, 4), foreground: hsl(270, 10, 98),
    card: hsl(270, 15, 6), cardForeground: hsl(270, 10, 98),
    primary: hsl(271, 91, 65), primaryForeground: hsl(270, 20, 4),
    secondary: hsl(270, 15, 12), secondaryForeground: hsl(270, 10, 98),
    muted: hsl(270, 15, 14), mutedForeground: hsl(270, 10, 60),
    accent: hsl(270, 15, 12), accentForeground: hsl(270, 10, 98),
    destructive: hsl(0, 62.8, 30.6), destructiveForeground: hsl(210, 40, 98),
    border: hsl(270, 12, 24), ring: hsl(271, 91, 65)
)

let lightPalette = ThemePalette(
    background: .white, foreground: hsl(222.2, 84, 4.9),
    card: .white, cardForeground: hsl(222.2, 84, 4.9),
    primary: hsl(221.2, 83.2, 53.3), primaryForeground: hsl(210, 40, 98),
    secondary: hsl(210, 40, 96.1), secondaryForeground: hsl(222.2, 47.4, 11.2),
    muted: hsl(210, 40, 96.1), mutedForeground: hsl(215.4, 16.3, 46.9),
    accent: hsl(210, 40, 96.1), accentForeground: hsl(222.2, 47.4, 11.2),
    destructive: hsl(0, 84.2, 60.2), destructiveForeground: hsl(210, 40, 98),
    border: hsl(214.3, 31.8, 91.4), ring: hsl(221.2, 83.2, 53.3)
)
