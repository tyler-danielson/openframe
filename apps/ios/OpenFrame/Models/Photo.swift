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
    var filename: String?
    var originalFilename: String?
    var mimeType: String?
    var thumbnailUrl: String?
    var mediumUrl: String?
    var originalUrl: String?
    var width: Int?
    var height: Int?
    var takenAt: String?
    var sortOrder: Int?
    var sourceType: String?

    /// Convenience: best available display URL
    var url: String? {
        mediumUrl ?? originalUrl
    }
}
