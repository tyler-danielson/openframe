import SwiftUI

@main
struct OpenFrameApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var container = DIContainer()
    @State private var isReady = false

    var body: some Scene {
        WindowGroup {
            Group {
                if !isReady {
                    LaunchScreen()
                        .environmentObject(container)
                } else if container.isAuthenticated {
                    AdaptiveNavigation()
                        .environmentObject(container)
                } else if container.keychainService.hasServerUrl {
                    LoginView()
                        .environmentObject(container)
                } else {
                    ServerUrlView()
                        .environmentObject(container)
                }
            }
            .task {
                ImageCacheService.configure()
                appDelegate.pushService = container.pushService
                if container.keychainService.hasCredentials {
                    await container.checkInitialAuth()
                } else if container.keychainService.hasServerUrl {
                    await container.loadAuthConfig()
                }
                isReady = true
            }
            .onOpenURL { url in
                container.handleDeepLink(url)
            }
        }
    }
}

private struct LaunchScreen: View {
    @EnvironmentObject var container: DIContainer

    var body: some View {
        let palette = container.themeManager.palette
        VStack(spacing: 16) {
            Image(systemName: "square.grid.2x2.fill")
                .font(.system(size: 60))
                .foregroundStyle(palette.primary)
            ProgressView()
                .tint(palette.primary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(palette.background.ignoresSafeArea())
    }
}
