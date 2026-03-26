import SwiftUI

extension String {
    /// Parse hex color string (#RGB, #RRGGBB, or #AARRGGBB) to SwiftUI Color
    func toColor() -> Color? {
        var hex = self.trimmingCharacters(in: .whitespacesAndNewlines)
        if hex.hasPrefix("#") { hex.removeFirst() }

        var rgbValue: UInt64 = 0
        guard Scanner(string: hex).scanHexInt64(&rgbValue) else { return nil }

        switch hex.count {
        case 3: // #RGB
            let r = Double((rgbValue >> 8) & 0xF) / 15.0
            let g = Double((rgbValue >> 4) & 0xF) / 15.0
            let b = Double(rgbValue & 0xF) / 15.0
            return Color(red: r, green: g, blue: b)
        case 6: // #RRGGBB
            let r = Double((rgbValue >> 16) & 0xFF) / 255.0
            let g = Double((rgbValue >> 8) & 0xFF) / 255.0
            let b = Double(rgbValue & 0xFF) / 255.0
            return Color(red: r, green: g, blue: b)
        case 8: // #AARRGGBB
            let a = Double((rgbValue >> 24) & 0xFF) / 255.0
            let r = Double((rgbValue >> 16) & 0xFF) / 255.0
            let g = Double((rgbValue >> 8) & 0xFF) / 255.0
            let b = Double(rgbValue & 0xFF) / 255.0
            return Color(red: r, green: g, blue: b).opacity(a)
        default:
            return nil
        }
    }
}
