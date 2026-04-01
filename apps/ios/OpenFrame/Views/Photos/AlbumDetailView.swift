import SwiftUI
import Kingfisher
import PhotosUI

struct AlbumDetailView: View {
    let album: PhotoAlbum
    @EnvironmentObject var container: DIContainer
    @State private var photos: [Photo] = []
    @State private var isLoading = true
    @State private var showPicker = false
    @State private var isUploading = false

    var body: some View {
        let palette = container.themeManager.palette
        Group {
            if photos.isEmpty && !isLoading {
                EmptyStateView(icon: "photo", title: "No Photos", message: "This album is empty")
            } else {
                ScrollView {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 4) {
                        ForEach(photos) { photo in
                            if let urlString = photo.thumbnailUrl ?? photo.url,
                               let fullUrl = buildImageURL(urlString) {
                                KFImage(fullUrl)
                                    .resizable()
                                    .placeholder { palette.secondary }
                                    .aspectRatio(1, contentMode: .fill)
                                    .clipped()
                            } else {
                                Rectangle()
                                    .fill(palette.secondary)
                                    .aspectRatio(1, contentMode: .fit)
                            }
                        }
                    }
                }
            }
        }
        .background(palette.background.ignoresSafeArea())
        .navigationTitle(album.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                if container.canViewPhotos {
                    Button {
                        showPicker = true
                    } label: {
                        if isUploading {
                            ProgressView()
                        } else {
                            Image(systemName: "plus")
                        }
                    }
                    .disabled(isUploading)
                }
            }
        }
        .sheet(isPresented: $showPicker) {
            PhotoPickerView { data in
                uploadPhoto(data)
            }
        }
        .task { await loadPhotos() }
        .refreshable { await loadPhotos() }
    }

    private func buildImageURL(_ path: String) -> URL? {
        if path.hasPrefix("http") { return URL(string: path) }
        guard let base = container.keychainService.serverUrl else { return nil }
        return URL(string: "\(base)\(path)")
    }

    private func loadPhotos() async {
        isLoading = true
        photos = (try? await container.photoRepository.getAlbumPhotos(albumId: album.id)) ?? []
        isLoading = false
    }

    private func uploadPhoto(_ data: Data) {
        isUploading = true
        Task {
            try? await container.photoRepository.uploadPhoto(albumId: album.id, imageData: data, fileName: "photo_\(UUID().uuidString).jpg")
            await loadPhotos()
            isUploading = false
        }
    }
}

// MARK: - Photo Picker (iOS 15 compatible)

struct PhotoPickerView: UIViewControllerRepresentable {
    let onPick: (Data) -> Void

    func makeUIViewController(context: Context) -> PHPickerViewController {
        var config = PHPickerConfiguration()
        config.selectionLimit = 1
        config.filter = .images
        let picker = PHPickerViewController(configuration: config)
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: PHPickerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onPick: onPick)
    }

    class Coordinator: NSObject, PHPickerViewControllerDelegate {
        let onPick: (Data) -> Void

        init(onPick: @escaping (Data) -> Void) {
            self.onPick = onPick
        }

        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            picker.dismiss(animated: true)
            guard let result = results.first else { return }
            result.itemProvider.loadDataRepresentation(forTypeIdentifier: "public.image") { [weak self] data, _ in
                if let data {
                    DispatchQueue.main.async {
                        self?.onPick(data)
                    }
                }
            }
        }
    }
}
