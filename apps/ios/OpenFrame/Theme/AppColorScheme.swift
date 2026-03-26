import SwiftUI

enum AppColorScheme: String, CaseIterable, Identifiable {
    case `default` = "default"
    case homio = "homio"
    case ocean = "ocean"
    case forest = "forest"
    case sunset = "sunset"
    case lavender = "lavender"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .default: return "Blue"
        case .homio: return "Gold"
        case .ocean: return "Teal"
        case .forest: return "Green"
        case .sunset: return "Orange"
        case .lavender: return "Purple"
        }
    }

    var accentColor: Color {
        switch self {
        case .default: return Color(red: 0.231, green: 0.510, blue: 0.965)  // #3B82F6
        case .homio: return Color(red: 0.769, green: 0.655, blue: 0.490)    // #C4A77D
        case .ocean: return Color(red: 0.078, green: 0.722, blue: 0.651)    // #14B8A6
        case .forest: return Color(red: 0.133, green: 0.773, blue: 0.369)   // #22C55E
        case .sunset: return Color(red: 0.976, green: 0.451, blue: 0.086)   // #F97316
        case .lavender: return Color(red: 0.659, green: 0.333, blue: 0.969) // #A855F7
        }
    }

    var darkPalette: ThemePalette {
        switch self {
        case .default: return bluePalette
        case .homio: return goldPalette
        case .ocean: return oceanPalette
        case .forest: return forestPalette
        case .sunset: return sunsetPalette
        case .lavender: return lavenderPalette
        }
    }

    static func from(key: String) -> AppColorScheme {
        AppColorScheme(rawValue: key) ?? .default
    }
}
