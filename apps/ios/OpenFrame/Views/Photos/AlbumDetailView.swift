import SwiftUI

struct AlbumDetailView: View {
    @EnvironmentObject private var appState: AppState
    let albumId: String
    @State private var viewModel: AlbumDetailViewModel?

    var body: some View {
        Group {
            if let vm = viewModel {
                AlbumDetailContentView(viewModel: vm)
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

    private let columns = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        if viewModel.isLoading && viewModel.photos.isEmpty {
            LoadingView()
        } else if viewModel.photos.isEmpty {
            EmptyStateView(icon: "photo", title: "No photos")
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
    }
}
