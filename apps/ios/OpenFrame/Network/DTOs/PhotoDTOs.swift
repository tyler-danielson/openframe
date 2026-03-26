import Foundation

struct PhotoAlbumDTO: Decodable {
    let id: String
    let name: String?
    let description: String?
    let coverPhotoId: String?
    let coverPhotoPath: String?
    let photoCount: Int?
    let source: String?
    let sourceType: String?

    func toDomain() -> PhotoAlbum {
        PhotoAlbum(
            id: id, name: name ?? "Untitled", description: description,
            coverPhotoPath: coverPhotoPath, photoCount: photoCount ?? 0, source: source
        )
    }
}

struct PhotoDTO: Decodable {
    let id: String
    let albumId: String?
    let filename: String?
    let originalFilename: String?
    let thumbnailPath: String?
    let mediumPath: String?
    let originalPath: String?
    let width: Int?
    let height: Int?
    let size: Int?
    let mimeType: String?
    let takenAt: String?
    let sortOrder: Int?
    let sourceType: String?

    func toDomain() -> Photo {
        Photo(
            id: id, albumId: albumId, filename: filename,
            thumbnailPath: thumbnailPath, mediumPath: mediumPath,
            originalPath: originalPath, width: width, height: height
        )
    }
}

struct CreateAlbumRequest: Encodable {
    let name: String
    let description: String?
}
