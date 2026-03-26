import Foundation
import Security

final class KeychainManager: Sendable {
    private let service = "us.openframe.app"

    private enum Key {
        static let serverUrl = "server_url"
        static let authMethod = "auth_method"
        static let accessToken = "access_token"
        static let refreshToken = "refresh_token"
        static let apiKey = "api_key"
    }

    enum AuthMethod: String {
        case bearer
        case apiKey = "api_key"
    }

    // MARK: - Server URL

    var serverUrl: String? {
        get { read(Key.serverUrl) }
        set {
            if let value = newValue {
                save(Key.serverUrl, value: value.hasSuffix("/") ? String(value.dropLast()) : value)
            } else {
                delete(Key.serverUrl)
            }
        }
    }

    // MARK: - Auth Method

    var authMethod: AuthMethod {
        get {
            guard let raw = read(Key.authMethod) else { return .bearer }
            return AuthMethod(rawValue: raw) ?? .bearer
        }
        set { save(Key.authMethod, value: newValue.rawValue) }
    }

    // MARK: - Tokens

    var accessToken: String? {
        get { read(Key.accessToken) }
        set {
            if let value = newValue { save(Key.accessToken, value: value) }
            else { delete(Key.accessToken) }
        }
    }

    var refreshToken: String? {
        get { read(Key.refreshToken) }
        set {
            if let value = newValue { save(Key.refreshToken, value: value) }
            else { delete(Key.refreshToken) }
        }
    }

    var apiKey: String? {
        get { read(Key.apiKey) }
        set {
            if let value = newValue { save(Key.apiKey, value: value) }
            else { delete(Key.apiKey) }
        }
    }

    // MARK: - Helpers

    func saveTokens(access: String, refresh: String) {
        accessToken = access
        refreshToken = refresh
        authMethod = .bearer
    }

    func saveApiKey(_ key: String) {
        apiKey = key
        authMethod = .apiKey
    }

    func clearAll() {
        delete(Key.serverUrl)
        delete(Key.authMethod)
        delete(Key.accessToken)
        delete(Key.refreshToken)
        delete(Key.apiKey)
    }

    func hasCredentials() -> Bool {
        switch authMethod {
        case .bearer:
            return accessToken?.isEmpty == false
        case .apiKey:
            return apiKey?.isEmpty == false
        }
    }

    func hasServerUrl() -> Bool {
        return serverUrl?.isEmpty == false
    }

    // MARK: - Keychain Operations

    private func save(_ key: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }
        delete(key) // Remove existing before saving
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        SecItemAdd(query as CFDictionary, nil)
    }

    private func read(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func delete(_ key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
