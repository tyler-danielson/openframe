import SwiftUI

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

func hsl(_ h: Double, _ s: Double, _ l: Double) -> Color {
    let s = s / 100.0
    let l = l / 100.0
    let c = (1.0 - abs(2.0 * l - 1.0)) * s
    let x = c * (1.0 - abs((h / 60.0).truncatingRemainder(dividingBy: 2.0) - 1.0))
    let m = l - c / 2.0

    var r = 0.0, g = 0.0, b = 0.0
    switch h {
    case 0..<60:   r = c; g = x; b = 0
    case 60..<120:  r = x; g = c; b = 0
    case 120..<180: r = 0; g = c; b = x
    case 180..<240: r = 0; g = x; b = c
    case 240..<300: r = x; g = 0; b = c
    default:        r = c; g = 0; b = x
    }

    return Color(red: r + m, green: g + m, blue: b + m)
}
