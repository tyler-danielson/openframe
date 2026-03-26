import SwiftUI
import AuthenticationServices

enum AuthScreen {
    case loading
    case serverUrl
    case login
    case signup
    case kioskPicker(User)
    case authenticated
}

@Observable
final class AuthViewModel {
    var screen: AuthScreen = .loading
    var isLoading = false
    var errorMessage: String?
    var serverUrl: String = ""
    var authConfig: AuthConfigDTO?
    var kiosks: [Kiosk] = []

    let appState: AppState

    init(appState: AppState) {
        self.appState = appState
    }

    var authRepository: AuthRepository { appState.authRepository }
    var kioskRepository: KioskRepository { appState.kioskRepository }
    var keychainManager: KeychainManager { appState.keychainManager }

    func checkInitialState() async {
        if appState.isAuthenticated {
            screen = .authenticated
        } else if appState.hasServerUrl {
            await loadAuthConfig()
            screen = .login
        } else {
            screen = .serverUrl
        }
    }

    // MARK: - Server URL

    func connectToServer(_ url: String) async {
        isLoading = true
        errorMessage = nil

        let cleanUrl = url.trimmingCharacters(in: .whitespacesAndNewlines)
        let fullUrl = cleanUrl.hasPrefix("http") ? cleanUrl : "https://\(cleanUrl)"

        let result = await authRepository.checkServerHealth(serverUrl: fullUrl)
        switch result {
        case .success(let ok) where ok:
            keychainManager.serverUrl = fullUrl
            serverUrl = fullUrl
            await loadAuthConfig()
            screen = .login
        case .success:
            errorMessage = "Server returned an error"
        case .failure(let error):
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func connectToOpenFrame() async {
        await connectToServer("https://openframe.us")
    }

    // MARK: - Auth Config

    func loadAuthConfig() async {
        let result = await authRepository.getAuthConfig()
        if case .success(let config) = result {
            authConfig = config
        }
    }

    // MARK: - Login

    func login(email: String, password: String) async {
        isLoading = true
        errorMessage = nil
        let result = await authRepository.login(email: email, password: password)
        await handleAuthResult(result)
        isLoading = false
    }

    func loginWithApiKey(_ key: String) async {
        isLoading = true
        errorMessage = nil
        let result = await authRepository.loginWithApiKey(key)
        await handleAuthResult(result)
        isLoading = false
    }

    func loginWithOAuth(provider: String) {
        guard let urlString = authRepository.getOAuthUrl(provider: provider),
              let url = URL(string: urlString) else {
            errorMessage = "Could not build OAuth URL"
            return
        }

        // Will be handled by ASWebAuthenticationSession in the view
        // Just provide the URL
        _ = url
    }

    func handleOAuthTokens(accessToken: String, refreshToken: String) async {
        authRepository.saveTokensFromDeepLink(accessToken: accessToken, refreshToken: refreshToken)
        let result = await authRepository.getCurrentUser()
        await handleAuthResult(result)
    }

    // MARK: - Signup

    func signup(name: String, email: String, password: String) async {
        isLoading = true
        errorMessage = nil
        let result = await authRepository.signup(name: name, email: email, password: password)
        await handleAuthResult(result)
        isLoading = false
    }

    // MARK: - Kiosk Picker

    func skipKioskPicker() {
        screen = .authenticated
    }

    // MARK: - Navigation

    func goToSignup() {
        errorMessage = nil
        screen = .signup
    }

    func goToLogin() {
        errorMessage = nil
        screen = .login
    }

    func goToServerUrl() {
        errorMessage = nil
        screen = .serverUrl
    }

    // MARK: - Private

    private func handleAuthResult(_ result: Result<User, Error>) async {
        switch result {
        case .success(let user):
            // Load kiosks for picker
            let kioskResult = await kioskRepository.getKiosks()
            if case .success(let loadedKiosks) = kioskResult, !loadedKiosks.isEmpty {
                kiosks = loadedKiosks
                screen = .kioskPicker(user)
            } else {
                screen = .authenticated
            }
        case .failure(let error):
            errorMessage = error.localizedDescription
        }
    }
}
