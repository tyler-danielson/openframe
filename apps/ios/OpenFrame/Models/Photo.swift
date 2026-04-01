import Foundation

struct PhotoAlbum: Identifiable, Codable {
    let id: String
    let name: String
    var isActive: Bool?
    var photoCount: Int?
    var createdAt: String?
}

struct Photo: Identifiable, Codable {
    let id: String
    let albumId: String
    var fileName: String?
    var url: String?
    var thumbnailUrl: String?
    var width: Int?
    var height: Int?
    var uploadedAt: String?
}
