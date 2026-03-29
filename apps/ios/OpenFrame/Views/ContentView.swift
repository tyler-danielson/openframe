import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var appState: AppState

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
