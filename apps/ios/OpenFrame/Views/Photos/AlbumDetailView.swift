import SwiftUI
import PhotosUI

struct AlbumDetailView: View {
    @EnvironmentObject private var appState: AppState
    let albumId: String
    @State private var viewModel: AlbumDetailViewModel?

    var body: some View {
        Group {
            if let vm = viewModel {
                AlbumDetailContentView(viewModel: vm, albumId: albumId)
            } else {
                LoadingView()
            }
        }
        .navigationTitle("Album")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            let vm = AlbumDetailViewModel(photoRepository: appState.photoRepository)
            viewModel = vm
            await vm.loadPhotos(albumId: albumId)
        }
    }
}

private struct AlbumDetailContentView: View {
    @ObservedObject var viewModel: AlbumDetailViewModel
    let albumId: String
    @State private var showingPicker = false

    private let columns = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        ZStack {
            if viewModel.isLoading && viewModel.photos.isEmpty {
                LoadingView()
            } else if viewModel.photos.isEmpty {
                EmptyStateView(icon: "photo", title: "No photos", subtitle: "Tap + to add one")
            } else {
                ScrollView {
                    LazyVGrid(columns: columns, spacing: 2) {
                        ForEach(viewModel.photos) { photo in
                            AsyncImage(url: viewModel.thumbnailUrl(for: photo)) { phase in
                                switch phase {
                                case .success(let image):
                                    image.resizable().aspectRatio(1, contentMode: .fill)
                                default:
                                    Rectangle()
                                        .fill(Color(.tertiarySystemGroupedBackground))
                                        .aspectRatio(1, contentMode: .fit)
                                }
                            }
                            .aspectRatio(1, contentMode: .fit)
                            .clipped()
                        }
                    }
                }
            }

            // Floating action button
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    Button {
                        showingPicker = true
                    } label: {
                        if viewModel.isUploading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .frame(width: 56, height: 56)
                                .background(Color.accentColor)
                                .clipShape(Circle())
                                .shadow(color: .black.opacity(0.25), radius: 4, x: 0, y: 2)
                        } else {
                            Image(systemName: "plus")
                                .font(.title2.weight(.semibold))
                                .foregroundColor(.white)
                                .frame(width: 56, height: 56)
                                .background(Color.accentColor)
                                .clipShape(Circle())
                                .shadow(color: .black.opacity(0.25), radius: 4, x: 0, y: 2)
                        }
                    }
                    .disabled(viewModel.isUploading)
                    .padding(.trailing, 16)
                    .padding(.bottom, 16)
                }
            }
        }
        .sheet(isPresented: $showingPicker) {
            PhotoPickerView { imageData in
                Task {
                    await viewModel.uploadPhoto(albumId: albumId, imageData: imageData)
                }
            }
        }
    }
}

// MARK: - PHPickerViewController wrapper (iOS 14+)

struct PhotoPickerView: UIViewControllerRepresentable {
    let onImagePicked: (Data) -> Void

    @Environment(\.presentationMode) var presentationMode

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
        Coordinator(self)
    }

    class Coordinator: NSObject, PHPickerViewControllerDelegate {
        let parent: PhotoPickerView

        init(_ parent: PhotoPickerView) {
            self.parent = parent
        }

        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            parent.presentationMode.wrappedValue.dismiss()

            guard let provider = results.first?.itemProvider,
                  provider.canLoadObject(ofClass: UIImage.self) else {
                return
            }

            provider.loadObject(ofClass: UIImage.self) { [weak self] object, _ in
                guard let image = object as? UIImage,
                      let data = image.jpegData(compressionQuality: 0.85) else {
                    return
                }
                DispatchQueue.main.async {
                    self?.parent.onImagePicked(data)
                }
            }
        }
    }
}
