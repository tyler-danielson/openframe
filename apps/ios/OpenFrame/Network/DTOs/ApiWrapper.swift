import Foundation

struct ApiWrapper<T: Decodable>: Decodable {
    let data: T?
    let success: Bool?
    let error: ApiErrorDto?
    let message: String?
}

struct ApiErrorDto: Decodable {
    let code: String?
    let message: String?
}

enum APIError: LocalizedError {
    case invalidURL
    case noData
    case decodingFailed(Error)
    case serverError(String)
    case unauthorized
    case networkError(Error)
    case unknown

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .noData: return "No data received"
        case .decodingFailed(let error): return "Decoding failed: \(error.localizedDescription)"
        case .serverError(let msg): return msg
        case .unauthorized: return "Unauthorized"
        case .networkError(let error): return error.localizedDescription
        case .unknown: return "Unknown error"
        }
    }
}
