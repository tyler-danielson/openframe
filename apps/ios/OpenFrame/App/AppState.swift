import SwiftUI

@Observable
final class AppState {
    let keychainManager = KeychainManager()
    let settingsManager = SettingsManager()
    let themeManager: ThemeManager

    private(set) var apiClient: APIClient!
    private(set) var authRepository: AuthRepository!
    private(set) var calendarRepository: CalendarRepository!
    private(set) var taskRepository: TaskRepository!
    private(set) var photoRepository: PhotoRepository!
    private(set) var kioskRepository: KioskRepository!

    var isAuthenticated: Bool {
        keychainManager.hasCredentials()
    }

    var hasServerUrl: Bool {
        keychainManager.hasServerUrl()
    }

    // Deep link state for OAuth callbacks
    var pendingDeepLinkTokens: (accessToken: String, refreshToken: String)?
    var pendingConnectLink: (server: String, apiKey: String)?

    init() {
        self.themeManager = ThemeManager(settingsManager: settingsManager)

        let client = APIClient(keychainManager: keychainManager)
        self.apiClient = client
        self.authRepository = AuthRepository(apiClient: client, keychainManager: keychainManager)
        self.calendarRepository = CalendarRepository(apiClient: client)
        self.taskRepository = TaskRepository(apiClient: client)
        self.photoRepository = PhotoRepository(apiClient: client, keychainManager: keychainManager)
        self.kioskRepository = KioskRepository(apiClient: client)
    }

    func handleDeepLink(_ url: URL) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let scheme = url.scheme, scheme == "openframe" else { return }

        let host = url.host
        let path = url.path

        if host == "auth" && path == "/callback" {
            // OAuth callback: openframe://auth/callback?accessToken=...&refreshToken=...
            let queryItems = components.queryItems ?? []
            if let accessToken = queryItems.first(where: { $0.name == "accessToken" })?.value,
               let refreshToken = queryItems.first(where: { $0.name == "refreshToken" })?.value {
                pendingDeepLinkTokens = (accessToken, refreshToken)
            }
        } else if host == "connect" {
            // QR connect: openframe://connect?server=URL&apiKey=KEY
            let queryItems = components.queryItems ?? []
            if let server = queryItems.first(where: { $0.name == "server" })?.value,
               let apiKey = queryItems.first(where: { $0.name == "apiKey" })?.value {
                pendingConnectLink = (server, apiKey)
            }
        }
    }

    func logout() {
        keychainManager.clearAll()
    }
}
