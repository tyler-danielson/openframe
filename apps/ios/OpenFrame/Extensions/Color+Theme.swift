import SwiftUI

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
