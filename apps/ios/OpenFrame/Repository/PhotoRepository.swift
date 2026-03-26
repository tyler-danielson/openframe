import Foundation

final class PhotoRepository: Sendable {
    private let apiClient: APIClient
    private let keychainManager: KeychainManager

    init(apiClient: APIClient, keychainManager: KeychainManager) {
        self.apiClient = apiClient
        self.keychainManager = keychainManager
    }

    func getAlbums() async -> Result<[PhotoAlbum], Error> {
        do {
            let dtos: [PhotoAlbumDTO] = try await apiClient.requestData(.get, path: "/api/v1/photos/albums")
            return .success(dtos.map { $0.toDomain() })
        } catch {
            return .failure(error)
        }
    }

    func getAlbumPhotos(albumId: String) async -> Result<[Photo], Error> {
        do {
            let dtos: [PhotoDTO] = try await apiClient.requestData(.get, path: "/api/v1/photos/albums/\(albumId)/photos")
            return .success(dtos.map { $0.toDomain() })
        } catch {
            return .failure(error)
        }
    }

    func createAlbum(name: String, description: String? = nil) async -> Result<PhotoAlbum, Error> {
        do {
            let body = CreateAlbumRequest(name: name, description: description)
            let dto: PhotoAlbumDTO = try await apiClient.requestData(.post, path: "/api/v1/photos/albums", body: body)
            return .success(dto.toDomain())
        } catch {
            return .failure(error)
        }
    }

    func deleteAlbum(id: String) async -> Result<Void, Error> {
        do {
            try await apiClient.requestVoid(.delete, path: "/api/v1/photos/albums/\(id)")
            return .success(())
        } catch {
            return .failure(error)
        }
    }

    /// Build an authenticated URL for loading photos
    func photoUrl(for path: String?) -> URL? {
        guard let path, let serverUrl = keychainManager.serverUrl else { return nil }
        var urlString = "\(serverUrl)\(path)"

        // Add auth query parameter
        switch keychainManager.authMethod {
        case .bearer:
            if let token = keychainManager.accessToken {
                urlString += (urlString.contains("?") ? "&" : "?") + "token=\(token)"
            }
        case .apiKey:
            if let key = keychainManager.apiKey {
                urlString += (urlString.contains("?") ? "&" : "?") + "apiKey=\(key)"
            }
        }

        return URL(string: urlString)
    }
}
