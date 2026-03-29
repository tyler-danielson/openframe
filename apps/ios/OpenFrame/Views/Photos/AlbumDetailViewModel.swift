import Foundation

final class AlbumDetailViewModel: ObservableObject {
    @Published var photos: [Photo] = []
    @Published var isLoading = false
    @Published var isUploading = false
    @Published var errorMessage: String?

    private let photoRepository: PhotoRepository

    init(photoRepository: PhotoRepository) {
        self.photoRepository = photoRepository
    }

    func loadPhotos(albumId: String) async {
        isLoading = true
        let result = await photoRepository.getAlbumPhotos(albumId: albumId)
        switch result {
        case .success(let loaded):
            photos = loaded
        case .failure(let error):
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func uploadPhoto(albumId: String, imageData: Data) async {
        isUploading = true
        do {
            let filename = "photo_\(Int(Date().timeIntervalSince1970)).jpg"
            try await photoRepository.uploadPhoto(albumId: albumId, imageData: imageData, filename: filename)
            await loadPhotos(albumId: albumId)
        } catch {
            errorMessage = "Upload failed: \(error.localizedDescription)"
        }
        isUploading = false
    }

    func thumbnailUrl(for photo: Photo) -> URL? {
        photoRepository.photoUrl(for: photo.thumbnailPath ?? photo.mediumPath ?? photo.originalPath)
    }

    func fullUrl(for photo: Photo) -> URL? {
        photoRepository.photoUrl(for: photo.mediumPath ?? photo.originalPath)
    }
}
