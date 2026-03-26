import Foundation

actor TokenRefresher {
    private var isRefreshing = false
    private var refreshTask: Task<Bool, Never>?

    func refresh(keychainManager: KeychainManager) async -> Bool {
        // If already refreshing, wait for existing task
        if let existing = refreshTask {
            return await existing.value
        }

        let task = Task<Bool, Never> {
            defer { self.refreshTask = nil }

            guard let serverUrl = keychainManager.serverUrl,
                  let refreshToken = keychainManager.refreshToken else {
                return false
            }

            let url = URL(string: "\(serverUrl)/api/v1/auth/refresh")!
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.timeoutInterval = 30

            let body = RefreshRequest(refreshToken: refreshToken)
            request.httpBody = try? JSONEncoder().encode(body)

            do {
                let (data, response) = try await URLSession.shared.data(for: request)
                guard let httpResponse = response as? HTTPURLResponse,
                      httpResponse.statusCode == 200 else {
                    return false
                }
                let wrapper = try JSONDecoder().decode(ApiWrapper<RefreshResponse>.self, from: data)
                guard let result = wrapper.data else { return false }
                keychainManager.saveTokens(access: result.accessToken, refresh: result.refreshToken)
                return true
            } catch {
                return false
            }
        }

        refreshTask = task
        return await task.value
    }
}

final class APIClient: Sendable {
    let keychainManager: KeychainManager
    private let session: URLSession
    private let tokenRefresher = TokenRefresher()
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(keychainManager: KeychainManager) {
        self.keychainManager = keychainManager

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        self.session = URLSession(configuration: config)

        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
    }

    // MARK: - Public API

    /// Make a request and decode the full response
    func request<T: Decodable>(_ method: HTTPMethod, path: String, body: (any Encodable)? = nil, query: [String: String]? = nil) async throws -> T {
        let data = try await performRequest(method, path: path, body: body, query: query)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingFailed(error)
        }
    }

    /// Make a request, unwrap ApiWrapper, and return the data field
    func requestData<T: Decodable>(_ method: HTTPMethod, path: String, body: (any Encodable)? = nil, query: [String: String]? = nil) async throws -> T {
        let wrapper: ApiWrapper<T> = try await request(method, path: path, body: body, query: query)
        if let error = wrapper.error {
            throw APIError.serverError(error.message ?? "Unknown server error")
        }
        guard let data = wrapper.data else {
            throw APIError.noData
        }
        return data
    }

    /// Make a request that returns no meaningful data
    func requestVoid(_ method: HTTPMethod, path: String, body: (any Encodable)? = nil, query: [String: String]? = nil) async throws {
        _ = try await performRequest(method, path: path, body: body, query: query)
    }

    /// Upload multipart form data
    func uploadMultipart<T: Decodable>(path: String, fileData: Data, fileName: String, mimeType: String) async throws -> T {
        let boundary = "Boundary-\(UUID().uuidString)"
        var request = try buildRequest(.post, path: path)
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var bodyData = Data()
        bodyData.append("--\(boundary)\r\n".data(using: .utf8)!)
        bodyData.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        bodyData.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        bodyData.append(fileData)
        bodyData.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)

        request.httpBody = bodyData

        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try decoder.decode(T.self, from: data)
    }

    // MARK: - Internal

    private func performRequest(_ method: HTTPMethod, path: String, body: (any Encodable)? = nil, query: [String: String]? = nil, isRetry: Bool = false) async throws -> Data {
        var request = try buildRequest(method, path: path, query: query)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let body = body {
            request.httpBody = try encoder.encode(AnyEncodable(body))
        }

        let (data, response) = try await session.data(for: request)

        if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 401, !isRetry {
            // Try token refresh for bearer auth
            if keychainManager.authMethod == .bearer {
                let refreshed = await tokenRefresher.refresh(keychainManager: keychainManager)
                if refreshed {
                    return try await performRequest(method, path: path, body: body, query: query, isRetry: true)
                }
            }
            throw APIError.unauthorized
        }

        try validateResponse(response)
        return data
    }

    private func buildRequest(_ method: HTTPMethod, path: String, query: [String: String]? = nil) throws -> URLRequest {
        guard let serverUrl = keychainManager.serverUrl else {
            throw APIError.invalidURL
        }

        var urlString = "\(serverUrl)\(path)"
        if let query = query, !query.isEmpty {
            var components = URLComponents(string: urlString)
            components?.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
            urlString = components?.url?.absoluteString ?? urlString
        }

        guard let url = URL(string: urlString) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.timeoutInterval = 30

        // Add auth headers (skip for login and refresh)
        let skipAuth = path.hasSuffix("/auth/login") || path.hasSuffix("/auth/refresh") || path.hasSuffix("/auth/signup")
        if !skipAuth {
            switch keychainManager.authMethod {
            case .bearer:
                if let token = keychainManager.accessToken {
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                }
            case .apiKey:
                if let key = keychainManager.apiKey {
                    request.setValue(key, forHTTPHeaderField: "X-API-Key")
                }
            }
        }

        return request
    }

    private func validateResponse(_ response: URLResponse) throws {
        guard let httpResponse = response as? HTTPURLResponse else { return }
        switch httpResponse.statusCode {
        case 200...299:
            return
        case 401:
            throw APIError.unauthorized
        default:
            throw APIError.serverError("HTTP \(httpResponse.statusCode)")
        }
    }
}

// MARK: - Supporting Types

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case patch = "PATCH"
    case put = "PUT"
    case delete = "DELETE"
}

// Type-erased Encodable wrapper
private struct AnyEncodable: Encodable {
    private let _encode: (Encoder) throws -> Void

    init(_ wrapped: any Encodable) {
        _encode = { encoder in
            try wrapped.encode(to: encoder)
        }
    }

    func encode(to encoder: Encoder) throws {
        try _encode(encoder)
    }
}
