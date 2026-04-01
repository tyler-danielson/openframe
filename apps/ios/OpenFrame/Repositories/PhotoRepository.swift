import Foundation

final class PhotoRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func getAlbums() async throws -> [PhotoAlbum] {
        try await apiClient.request(.getAlbums)
    }

    func getAlbumPhotos(albumId: String) async throws -> [Photo] {
        try await apiClient.request(.getAlbumPhotos(albumId: albumId))
    }

    func uploadPhoto(albumId: String, imageData: Data, fileName: String) async throws {
        try await apiClient.uploadVoid(
            path: "/api/v1/companion/data/albums/\(albumId)/photos",
            fileData: imageData,
            fileName: fileName,
            mimeType: "image/jpeg"
        )
    }

    func deletePhoto(id: String) async throws {
        try await apiClient.requestVoid(.deletePhoto(id: id))
    }
}
