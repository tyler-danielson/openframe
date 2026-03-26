import SwiftUI

@main
struct OpenFrameApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(appState)
                .environment(appState.themeManager)
                .preferredColorScheme(appState.themeManager.prefersDark ? .dark : nil)
                .onOpenURL { url in
                    appState.handleDeepLink(url)
                }
        }
    }
}
