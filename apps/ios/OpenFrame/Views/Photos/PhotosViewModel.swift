import Foundation

@Observable
final class PhotosViewModel {
    var albums: [PhotoAlbum] = []
    var isLoading = false
    var errorMessage: String?

    private let photoRepository: PhotoRepository

    init(photoRepository: PhotoRepository) {
        self.photoRepository = photoRepository
    }

    func loadAlbums() async {
        isLoading = true
        let result = await photoRepository.getAlbums()
        switch result {
        case .success(let loaded):
            albums = loaded
        case .failure(let error):
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func coverUrl(for album: PhotoAlbum) -> URL? {
        photoRepository.photoUrl(for: album.coverPhotoPath)
    }
}
