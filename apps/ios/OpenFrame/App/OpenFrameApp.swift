import SwiftUI

@main
struct OpenFrameApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .environmentObject(appState.themeManager)
                .preferredColorScheme(appState.themeManager.prefersDark ? .dark : nil)
                .onOpenURL { url in
                    appState.handleDeepLink(url)
                }
        }
    }
}
