import Foundation
import Alamofire

final class AuthInterceptor: RequestInterceptor {
    private let keychainService: KeychainService
    private let lock = NSLock()
    private var isRefreshing = false
    private var pendingRequests: [(RetryResult) -> Void] = []
    private var baseURL: String { keychainService.serverUrl ?? "" }

    init(keychainService: KeychainService) {
        self.keychainService = keychainService
    }

    // MARK: - RequestAdapter

    func adapt(_ urlRequest: URLRequest, for session: Session, completion: @escaping (Result<URLRequest, Error>) -> Void) {
        var request = urlRequest

        // Rewrite placeholder URL to actual server URL
        if let urlString = request.url?.absoluteString,
           urlString.hasPrefix("placeholder/") {
            let path = urlString.replacingOccurrences(of: "placeholder/", with: "")
            request.url = URL(string: "\(baseURL)/\(path)")
        }

        // Skip auth for public endpoints
        let skipPaths = ["/auth/login", "/auth/signup", "/auth/refresh", "/auth/config", "/health"]
        let shouldSkip = skipPaths.contains(where: { request.url?.path.hasSuffix($0) == true })

        if !shouldSkip {
            switch keychainService.authMethod {
            case .bearer:
                if let token = keychainService.accessToken {
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                }
            case .apiKey:
                if let key = keychainService.apiKey {
                    request.setValue(key, forHTTPHeaderField: "X-API-Key")
                }
            }
        }

        completion(.success(request))
    }

    // MARK: - RequestRetrier

    func retry(_ request: Request, for session: Session, dueTo error: Error, completion: @escaping (RetryResult) -> Void) {
        guard let response = request.task?.response as? HTTPURLResponse,
              response.statusCode == 401,
              keychainService.authMethod == .bearer,
              keychainService.refreshToken != nil else {
            completion(.doNotRetry)
            return
        }

        // Don't retry the refresh request itself
        if request.request?.url?.path.hasSuffix("/auth/refresh") == true {
            completion(.doNotRetry)
            return
        }

        lock.lock()
        pendingRequests.append(completion)

        if isRefreshing {
            lock.unlock()
            return
        }

        isRefreshing = true
        lock.unlock()

        refreshTokens(session: session)
    }

    // MARK: - Token Refresh

    private func refreshTokens(session: Session) {
        guard let refreshToken = keychainService.refreshToken else {
            failPendingRequests()
            return
        }

        let url = "\(baseURL)/api/v1/auth/refresh"
        let body = ["refreshToken": refreshToken]

        AF.request(url, method: .post, parameters: body, encoding: JSONEncoding.default)
            .validate()
            .responseDecodable(of: ApiWrapper<RefreshResponse>.self) { [weak self] response in
                guard let self else { return }
                switch response.result {
                case .success(let wrapper):
                    if let data = wrapper.data {
                        self.keychainService.saveTokens(access: data.accessToken, refresh: data.refreshToken)
                        self.retryPendingRequests()
                    } else {
                        self.failPendingRequests()
                    }
                case .failure:
                    self.keychainService.clearCredentials()
                    self.failPendingRequests()
                    NotificationCenter.default.post(name: .authSessionExpired, object: nil)
                }
            }
    }

    private func retryPendingRequests() {
        lock.lock()
        let requests = pendingRequests
        pendingRequests.removeAll()
        isRefreshing = false
        lock.unlock()

        requests.forEach { $0(.retry) }
    }

    private func failPendingRequests() {
        lock.lock()
        let requests = pendingRequests
        pendingRequests.removeAll()
        isRefreshing = false
        lock.unlock()

        requests.forEach { $0(.doNotRetry) }
    }
}

extension Notification.Name {
    static let authSessionExpired = Notification.Name("authSessionExpired")
}
