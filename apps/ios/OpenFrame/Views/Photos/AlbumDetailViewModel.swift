import Foundation

@Observable
final class AlbumDetailViewModel {
    var photos: [Photo] = []
    var isLoading = false
    var errorMessage: String?

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

    func thumbnailUrl(for photo: Photo) -> URL? {
        photoRepository.photoUrl(for: photo.thumbnailPath ?? photo.mediumPath ?? photo.originalPath)
    }

    func fullUrl(for photo: Photo) -> URL? {
        photoRepository.photoUrl(for: photo.mediumPath ?? photo.originalPath)
    }
}
