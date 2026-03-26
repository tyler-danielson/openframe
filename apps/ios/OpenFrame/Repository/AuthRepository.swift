import Foundation

final class AuthRepository: Sendable {
    private let apiClient: APIClient
    private let keychainManager: KeychainManager

    init(apiClient: APIClient, keychainManager: KeychainManager) {
        self.apiClient = apiClient
        self.keychainManager = keychainManager
    }

    func checkServerHealth(serverUrl: String) async -> Result<Bool, Error> {
        do {
            let url = URL(string: "\(serverUrl)/api/v1/health")!
            let (_, response) = try await URLSession.shared.data(from: url)
            let ok = (response as? HTTPURLResponse)?.statusCode == 200
            return .success(ok)
        } catch {
            return .failure(error)
        }
    }

    func getAuthConfig() async -> Result<AuthConfigDTO, Error> {
        do {
            let config: AuthConfigDTO = try await apiClient.requestData(.get, path: "/api/v1/auth/config")
            return .success(config)
        } catch {
            return .failure(error)
        }
    }

    func signup(name: String, email: String, password: String) async -> Result<User, Error> {
        do {
            let body = SignupRequest(email: email, name: name, password: password)
            let response: SignupResponse = try await apiClient.requestData(.post, path: "/api/v1/auth/signup", body: body)
            keychainManager.saveTokens(access: response.accessToken, refresh: response.refreshToken)
            return .success(response.user.toDomain())
        } catch {
            return .failure(error)
        }
    }

    func login(email: String, password: String) async -> Result<User, Error> {
        do {
            let body = LoginRequest(email: email, password: password)
            let response: LoginResponse = try await apiClient.requestData(.post, path: "/api/v1/auth/login", body: body)
            keychainManager.saveTokens(access: response.accessToken, refresh: response.refreshToken)
            return .success(response.user.toDomain())
        } catch {
            return .failure(error)
        }
    }

    func loginWithApiKey(_ key: String) async -> Result<User, Error> {
        do {
            keychainManager.saveApiKey(key)
            let user: UserDTO = try await apiClient.requestData(.get, path: "/api/v1/auth/me")
            return .success(user.toDomain())
        } catch {
            keychainManager.clearAll()
            return .failure(error)
        }
    }

    func loginWithGoogleIdToken(_ idToken: String) async -> Result<User, Error> {
        do {
            let body = GoogleIdTokenRequest(idToken: idToken)
            let response: GoogleIdTokenResponse = try await apiClient.requestData(.post, path: "/api/v1/auth/google-id-token", body: body)
            keychainManager.saveTokens(access: response.accessToken, refresh: response.refreshToken)
            return .success(response.user.toDomain())
        } catch {
            return .failure(error)
        }
    }

    func getCurrentUser() async -> Result<User, Error> {
        do {
            let user: UserDTO = try await apiClient.requestData(.get, path: "/api/v1/auth/me")
            return .success(user.toDomain())
        } catch {
            return .failure(error)
        }
    }

    func createDeviceCode() async -> Result<DeviceCodeResponse, Error> {
        do {
            let response: DeviceCodeResponse = try await apiClient.requestData(.post, path: "/api/v1/auth/device-codes", body: DeviceCodeRequest())
            return .success(response)
        } catch {
            return .failure(error)
        }
    }

    func pollDeviceCode(_ code: String) async -> Result<DeviceCodePollResponse, Error> {
        do {
            let body = DeviceCodePollRequest(deviceCode: code)
            let response: DeviceCodePollResponse = try await apiClient.requestData(.post, path: "/api/v1/auth/device-code/poll", body: body)
            return .success(response)
        } catch {
            return .failure(error)
        }
    }

    func getOAuthUrl(provider: String) -> String? {
        guard let serverUrl = keychainManager.serverUrl else { return nil }
        return "\(serverUrl)/api/v1/auth/oauth/\(provider)?redirect=openframe://auth/callback"
    }

    func saveTokensFromDeepLink(accessToken: String, refreshToken: String) {
        keychainManager.saveTokens(access: accessToken, refresh: refreshToken)
    }

    func logout() {
        keychainManager.clearAll()
    }
}
