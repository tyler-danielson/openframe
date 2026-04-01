import SwiftUI

extension Color {
    func opacity(_ value: Double) -> Color {
        self.opacity(value)
    }
}

extension View {
    func themedBackground(_ palette: ThemePalette) -> some View {
        self.background(palette.background.ignoresSafeArea())
    }

    func cardStyle(_ palette: ThemePalette) -> some View {
        self
            .padding()
            .background(palette.secondary)
            .cornerRadius(12)
    }
}
