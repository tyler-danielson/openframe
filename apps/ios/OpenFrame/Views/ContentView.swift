import SwiftUI

struct ContentView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            if appState.isAuthenticated {
                MainTabView()
            } else {
                AuthFlowView(appState: appState)
            }
        }
        .animation(.easeInOut, value: appState.isAuthenticated)
    }
}
