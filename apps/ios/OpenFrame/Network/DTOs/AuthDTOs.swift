import Foundation

struct AuthConfigDTO: Decodable {
    let google: GoogleConfigDTO?
    let microsoft: MicrosoftConfigDTO?
    let emailPassword: Bool?
    let signup: Bool?
}

struct GoogleConfigDTO: Decodable {
    let clientId: String?
}

struct MicrosoftConfigDTO: Decodable {
    let available: Bool?
}

struct LoginResponse: Decodable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int?
    let user: User?
}

struct SignupResponse: Decodable {
    let user: User
    let accessToken: String
    let refreshToken: String
}

struct RefreshResponse: Decodable {
    let accessToken: String
    let refreshToken: String
}
