import Foundation

// MARK: - Request DTOs

struct LoginRequest: Encodable {
    let email: String
    let password: String
}

struct SignupRequest: Encodable {
    let email: String
    let name: String
    let password: String
}

struct GoogleIdTokenRequest: Encodable {
    let idToken: String
}

struct RefreshRequest: Encodable {
    let refreshToken: String
}

struct DeviceCodeRequest: Encodable {
    let placeholder: String? = nil
}

struct DeviceCodePollRequest: Encodable {
    let deviceCode: String
}

// MARK: - Response DTOs

struct LoginResponse: Decodable {
    let user: UserDTO
    let accessToken: String
    let refreshToken: String
}

struct SignupResponse: Decodable {
    let user: UserDTO
    let accessToken: String
    let refreshToken: String
}

struct GoogleIdTokenResponse: Decodable {
    let user: UserDTO
    let accessToken: String
    let refreshToken: String
}

struct RefreshResponse: Decodable {
    let accessToken: String
    let refreshToken: String
}

struct UserDTO: Decodable {
    let id: String
    let email: String
    let name: String?
    let avatarUrl: String?
    let role: String?
    let timezone: String?

    func toDomain() -> User {
        User(id: id, email: email, name: name, avatarUrl: avatarUrl, role: role, timezone: timezone)
    }
}

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

struct DeviceCodeResponse: Decodable {
    let deviceCode: String
    let userCode: String
    let verificationUrl: String
    let expiresIn: Int
}

struct DeviceCodePollResponse: Decodable {
    let status: String
    let accessToken: String?
    let refreshToken: String?
    let user: UserDTO?
}
