import SwiftUI

struct AlbumDetailView: View {
    @Environment(AppState.self) private var appState
    let albumId: String
    @State private var viewModel: AlbumDetailViewModel?

    private let columns = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        Group {
            if let vm = viewModel {
                albumContent(vm)
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

    @ViewBuilder
    private func albumContent(_ vm: AlbumDetailViewModel) -> some View {
        if vm.isLoading && vm.photos.isEmpty {
            LoadingView()
        } else if vm.photos.isEmpty {
            EmptyStateView(icon: "photo", title: "No photos")
        } else {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 2) {
                    ForEach(vm.photos) { photo in
                        AsyncImage(url: vm.thumbnailUrl(for: photo)) { phase in
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
    }
}
