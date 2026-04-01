import Foundation
import KeychainAccess

enum AuthMethod: String {
    case bearer
    case apiKey
}

final class KeychainService {
    private let keychain = Keychain(service: "us.openframe.app")
        .accessibility(.afterFirstUnlock)

    // MARK: - Server URL

    var serverUrl: String? {
        get { keychain[string: "serverUrl"] }
        set { keychain[string: "serverUrl"] = newValue }
    }

    var hasServerUrl: Bool { serverUrl != nil && !(serverUrl?.isEmpty ?? true) }

    // MARK: - Auth Method

    var authMethod: AuthMethod {
        get {
            guard let raw = keychain[string: "authMethod"] else { return .bearer }
            return AuthMethod(rawValue: raw) ?? .bearer
        }
        set { keychain[string: "authMethod"] = newValue.rawValue }
    }

    // MARK: - Tokens

    var accessToken: String? {
        get { keychain[string: "accessToken"] }
        set { keychain[string: "accessToken"] = newValue }
    }

    var refreshToken: String? {
        get { keychain[string: "refreshToken"] }
        set { keychain[string: "refreshToken"] = newValue }
    }

    var apiKey: String? {
        get { keychain[string: "apiKey"] }
        set { keychain[string: "apiKey"] = newValue }
    }

    // MARK: - Push

    var deviceId: String {
        if let existing = keychain[string: "deviceId"] {
            return existing
        }
        let newId = UUID().uuidString
        keychain[string: "deviceId"] = newId
        return newId
    }

    var pushToken: String? {
        get { keychain[string: "pushToken"] }
        set { keychain[string: "pushToken"] = newValue }
    }

    // MARK: - Credentials State

    var hasCredentials: Bool {
        switch authMethod {
        case .bearer: return accessToken != nil
        case .apiKey: return apiKey != nil
        }
    }

    // MARK: - Save / Clear

    func saveTokens(access: String, refresh: String) {
        authMethod = .bearer
        accessToken = access
        refreshToken = refresh
    }

    func saveApiKey(_ key: String) {
        authMethod = .apiKey
        apiKey = key
    }

    func clearCredentials() {
        accessToken = nil
        refreshToken = nil
        apiKey = nil
        authMethod = .bearer
    }

    func clearAll() {
        clearCredentials()
        serverUrl = nil
        pushToken = nil
    }
}
