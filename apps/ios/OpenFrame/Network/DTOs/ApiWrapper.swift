import Foundation

struct ApiWrapper<T: Decodable>: Decodable {
    let success: Bool?
    let data: T?
    let error: ApiErrorDTO?
    let message: String?
}

struct ApiErrorDTO: Decodable {
    let code: String?
    let message: String?
}
