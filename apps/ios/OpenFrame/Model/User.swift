import Foundation

struct User: Identifiable, Codable, Sendable, Equatable {
    let id: String
    let email: String
    let name: String?
    let avatarUrl: String?
    let role: String?
    let timezone: String?
}
