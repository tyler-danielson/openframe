import SwiftUI
import Combine

@MainActor
final class DIContainer: ObservableObject {
    // MARK: - Core Services
    let keychainService: KeychainService
    let apiClient: APIClient
    let themeManager: ThemeManager
    let pushService: PushNotificationService
    let webSocketClient: WebSocketClient

    // MARK: - Repositories
    lazy var authRepository = AuthRepository(apiClient: apiClient, keychainService: keychainService)
    lazy var calendarRepository = CalendarRepository(apiClient: apiClient)
    lazy var taskRepository = TaskRepository(apiClient: apiClient)
    lazy var photoRepository = PhotoRepository(apiClient: apiClient)
    lazy var kioskRepository = KioskRepository(apiClient: apiClient)
    lazy var recipeRepository = RecipeRepository(apiClient: apiClient)
    lazy var weatherRepository = WeatherRepository(apiClient: apiClient)
    lazy var newsRepository = NewsRepository(apiClient: apiClient)
    lazy var haRepository = HomeAssistantRepository(apiClient: apiClient)
    lazy var iptvRepository = IptvRepository(apiClient: apiClient)
    lazy var companionRepository = CompanionRepository(apiClient: apiClient)
    lazy var pushRepository = PushRepository(apiClient: apiClient)

    // MARK: - State
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var companionContext: CompanionContext?
    @Published var authConfig: AuthConfigDTO?

    private var cancellables = Set<AnyCancellable>()

    init() {
        self.keychainService = KeychainService()
        self.apiClient = APIClient(keychainService: keychainService)
        self.themeManager = ThemeManager()
        self.pushService = PushNotificationService()
        self.webSocketClient = WebSocketClient()
        self.webSocketClient.configure(keychainService: keychainService)
        self.isAuthenticated = keychainService.hasCredentials

        NotificationCenter.default.publisher(for: .authSessionExpired)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.handleSessionExpired()
            }
            .store(in: &cancellables)
    }

    // MARK: - Auth State

    func checkInitialAuth() async {
        guard keychainService.hasCredentials else {
            isAuthenticated = false
            return
        }
        do {
            currentUser = try await authRepository.getCurrentUser()
            isAuthenticated = true
            await loadCompanionContext()
        } catch {
            isAuthenticated = false
            keychainService.clearCredentials()
        }
    }

    func loadAuthConfig() async {
        do {
            authConfig = try await authRepository.getAuthConfig()
        } catch {
            print("[DIContainer] Failed to load auth config: \(error)")
        }
    }

    func loadCompanionContext() async {
        do {
            companionContext = try await companionRepository.getContext()
        } catch {
            print("[DIContainer] Failed to load companion context: \(error)")
            // Fallback: owner with all permissions
            companionContext = CompanionContext(isOwner: true, permissions: nil)
        }
    }

    func handleLogin(user: User) async {
        currentUser = user
        isAuthenticated = true
        await loadCompanionContext()
        pushService.registerIfNeeded()
    }

    func handleLogout() async {
        await authRepository.logout()
        if let deviceId = Optional(keychainService.deviceId) {
            try? await pushRepository.unregisterToken(deviceId: deviceId)
        }
        currentUser = nil
        companionContext = nil
        isAuthenticated = false
    }

    // MARK: - Permissions

    var permissions: CompanionPermissions? { companionContext?.permissions }
    var isOwner: Bool { companionContext?.isOwner ?? true }

    var canViewCalendar: Bool { isOwner || (permissions?.canViewCalendar ?? false) }
    var canEditCalendar: Bool { isOwner || (permissions?.canEditCalendar ?? false) }
    var canViewTasks: Bool { isOwner || (permissions?.canViewTasks ?? false) }
    var canEditTasks: Bool { isOwner || (permissions?.canEditTasks ?? false) }
    var canViewKiosks: Bool { isOwner || (permissions?.canViewKiosks ?? false) }
    var canViewPhotos: Bool { isOwner || (permissions?.canViewPhotos ?? false) }
    var canViewRecipes: Bool { isOwner || (permissions?.canViewRecipes ?? false) }
    var canViewIptv: Bool { isOwner || (permissions?.canViewIptv ?? false) }
    var canViewHA: Bool { isOwner || (permissions?.canViewHomeAssistant ?? false) }
    var canViewNews: Bool { isOwner || (permissions?.canViewNews ?? false) }
    var canViewWeather: Bool { isOwner || (permissions?.canViewWeather ?? false) }

    // MARK: - Deep Links

    func handleDeepLink(_ url: URL) {
        guard url.scheme == "openframe" else { return }
        let host = url.host

        switch host {
        case "auth":
            if url.path == "/callback" {
                let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
                let items = components?.queryItems ?? []
                if let accessToken = items.first(where: { $0.name == "accessToken" })?.value,
                   let refreshToken = items.first(where: { $0.name == "refreshToken" })?.value {
                    authRepository.saveOAuthTokens(accessToken: accessToken, refreshToken: refreshToken)
                    Task { await checkInitialAuth() }
                }
            }
        case "connect":
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            let items = components?.queryItems ?? []
            if let server = items.first(where: { $0.name == "server" })?.value {
                keychainService.serverUrl = server
            }
            if let apiKey = items.first(where: { $0.name == "apiKey" })?.value {
                keychainService.saveApiKey(apiKey)
                Task { await checkInitialAuth() }
            }
        default:
            break
        }
    }

    // MARK: - Private

    private func handleSessionExpired() {
        currentUser = nil
        companionContext = nil
        isAuthenticated = false
    }
}
