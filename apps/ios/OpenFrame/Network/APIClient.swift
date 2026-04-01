import Foundation
import Alamofire

final class APIClient {
    let session: Session
    let keychainService: KeychainService

    init(keychainService: KeychainService) {
        self.keychainService = keychainService
        let interceptor = AuthInterceptor(keychainService: keychainService)
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        self.session = Session(configuration: config, interceptor: interceptor)
    }

    var baseURL: String { keychainService.serverUrl ?? "" }

    // MARK: - Generic Requests

    /// Perform request, unwrap ApiWrapper, return data
    func request<T: Decodable>(_ route: APIRouter) async throws -> T {
        let wrapper: ApiWrapper<T> = try await session
            .request(route)
            .validate()
            .serializingDecodable(ApiWrapper<T>.self, decoder: Self.decoder)
            .value

        if let error = wrapper.error {
            throw APIError.serverError(error.message ?? "Unknown server error")
        }
        guard let data = wrapper.data else {
            throw APIError.noData
        }
        return data
    }

    /// Perform request, return raw decoded value (no ApiWrapper)
    func requestRaw<T: Decodable>(_ route: APIRouter) async throws -> T {
        try await session
            .request(route)
            .validate()
            .serializingDecodable(T.self, decoder: Self.decoder)
            .value
    }

    /// Perform request, discard response
    func requestVoid(_ route: APIRouter) async throws {
        _ = try await session
            .request(route)
            .validate()
            .serializingData()
            .value
    }

    /// Upload multipart file, unwrap ApiWrapper
    func upload<T: Decodable>(
        path: String,
        fileData: Data,
        fileName: String,
        mimeType: String,
        additionalFields: [String: String]? = nil
    ) async throws -> T {
        let url = "\(baseURL)\(path)"
        let wrapper: ApiWrapper<T> = try await session
            .upload(multipartFormData: { form in
                form.append(fileData, withName: "file", fileName: fileName, mimeType: mimeType)
                additionalFields?.forEach { key, value in
                    form.append(Data(value.utf8), withName: key)
                }
            }, to: url)
            .validate()
            .serializingDecodable(ApiWrapper<T>.self, decoder: Self.decoder)
            .value

        if let error = wrapper.error {
            throw APIError.serverError(error.message ?? "Upload failed")
        }
        guard let data = wrapper.data else {
            throw APIError.noData
        }
        return data
    }

    /// Upload multipart file, discard response
    func uploadVoid(
        path: String,
        fileData: Data,
        fileName: String,
        mimeType: String,
        additionalFields: [String: String]? = nil
    ) async throws {
        let url = "\(baseURL)\(path)"
        _ = try await session
            .upload(multipartFormData: { form in
                form.append(fileData, withName: "file", fileName: fileName, mimeType: mimeType)
                additionalFields?.forEach { key, value in
                    form.append(Data(value.utf8), withName: key)
                }
            }, to: url)
            .validate()
            .serializingData()
            .value
    }

    // MARK: - JSON Decoder

    private static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .useDefaultKeys
        return d
    }()
}

// MARK: - API Error

enum APIError: LocalizedError {
    case serverError(String)
    case noData
    case unauthorized
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .serverError(let msg): return msg
        case .noData: return "No data received"
        case .unauthorized: return "Session expired. Please sign in again."
        case .networkError(let error): return error.localizedDescription
        }
    }
}
