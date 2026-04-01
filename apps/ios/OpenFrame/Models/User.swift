import Foundation

struct User: Identifiable, Codable {
    let id: String
    let email: String
    var name: String?
    var avatarUrl: String?
    var role: String?
    var timezone: String?
}
