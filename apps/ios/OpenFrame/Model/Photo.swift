import Foundation

struct PhotoAlbum: Identifiable, Codable, Sendable, Equatable {
    let id: String
    let name: String
    let description: String?
    let coverPhotoPath: String?
    let photoCount: Int
    let source: String?
}

struct Photo: Identifiable, Codable, Sendable, Equatable {
    let id: String
    let albumId: String?
    let filename: String?
    let thumbnailPath: String?
    let mediumPath: String?
    let originalPath: String?
    let width: Int?
    let height: Int?
}
