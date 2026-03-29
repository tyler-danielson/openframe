import SwiftUI

final class ThemeManager: ObservableObject {
    private let settingsManager: SettingsManager

    @Published var prefersDark: Bool = true

    var currentScheme: AppColorScheme {
        AppColorScheme.from(key: settingsManager.colorScheme)
    }

    var palette: ThemePalette {
        prefersDark ? currentScheme.darkPalette : lightPalette
    }

    init(settingsManager: SettingsManager) {
        self.settingsManager = settingsManager
    }

    func setScheme(_ scheme: AppColorScheme) {
        settingsManager.colorScheme = scheme.rawValue
    }
}

// MARK: - Environment Key

private struct ThemeManagerKey: EnvironmentKey {
    static let defaultValue = ThemeManager(settingsManager: SettingsManager())
}

extension EnvironmentValues {
    var theme: ThemeManager {
        get { self[ThemeManagerKey.self] }
        set { self[ThemeManagerKey.self] = newValue }
    }
}
