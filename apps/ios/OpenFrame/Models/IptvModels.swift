import Foundation

struct IptvChannel: Identifiable, Codable {
    let id: String
    var serverId: String?
    var categoryId: String?
    var name: String
    var logo: String?
    var streamUrl: String?
    var epgId: String?
    var isFavorite: Bool?
    var isHidden: Bool?
}

struct IptvCategory: Identifiable, Codable {
    let id: String
    var serverId: String?
    var name: String
    var channelCount: Int?
}
