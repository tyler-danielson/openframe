import Foundation

final class AuthRepository {
    private let apiClient: APIClient
    private let keychainService: KeychainService

    init(apiClient: APIClient, keychainService: KeychainService) {
        self.apiClient = apiClient
        self.keychainService = keychainService
    }

    func checkServerHealth(serverUrl: String) async -> Bool {
        do {
            let url = URL(string: "\(serverUrl)/api/v1/health")!
            let (_, response) = try await URLSession.shared.data(from: url)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch {
            return false
        }
    }

    func getAuthConfig() async throws -> AuthConfigDTO {
        try await apiClient.request(.authConfig)
    }

    func login(email: String, password: String) async throws -> User {
        let response: LoginResponse = try await apiClient.request(.login(email: email, password: password))
        keychainService.saveTokens(access: response.accessToken, refresh: response.refreshToken)
        return try await getCurrentUser()
    }

    func signup(name: String, email: String, password: String) async throws -> User {
        let response: SignupResponse = try await apiClient.request(.signup(name: name, email: email, password: password))
        keychainService.saveTokens(access: response.accessToken, refresh: response.refreshToken)
        return response.user
    }

    func loginWithApiKey(_ key: String) async throws -> User {
        keychainService.saveApiKey(key)
        return try await getCurrentUser()
    }

    func getCurrentUser() async throws -> User {
        try await apiClient.request(.getCurrentUser)
    }

    func logout() async {
        if let refreshToken = keychainService.refreshToken {
            try? await apiClient.requestVoid(.logout(refreshToken: refreshToken))
        }
        keychainService.clearCredentials()
    }

    func saveOAuthTokens(accessToken: String, refreshToken: String) {
        keychainService.saveTokens(access: accessToken, refresh: refreshToken)
    }

    func getOAuthURL(provider: String) -> URL? {
        guard let serverUrl = keychainService.serverUrl else { return nil }
        var components = URLComponents(string: "\(serverUrl)/api/v1/auth/oauth/\(provider)")
        components?.queryItems = [
            URLQueryItem(name: "callbackUrl", value: "openframe://auth/callback"),
            URLQueryItem(name: "mobile", value: "true"),
        ]
        return components?.url
    }
}
