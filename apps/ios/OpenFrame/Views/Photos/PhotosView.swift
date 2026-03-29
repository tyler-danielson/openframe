import SwiftUI

struct PhotosView: View {
    @EnvironmentObject private var appState: AppState
    @State private var viewModel: PhotosViewModel?

    var onNavigateToAlbum: (String) -> Void

    var body: some View {
        Group {
            if let vm = viewModel {
                PhotosContentView(viewModel: vm, onNavigateToAlbum: onNavigateToAlbum)
            } else {
                LoadingView()
            }
        }
        .navigationTitle("Photos")
        .task {
            let vm = PhotosViewModel(photoRepository: appState.photoRepository)
            viewModel = vm
            await vm.loadAlbums()
        }
    }
}

private struct PhotosContentView: View {
    @ObservedObject var viewModel: PhotosViewModel
    var onNavigateToAlbum: (String) -> Void

    private let columns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        if viewModel.isLoading && viewModel.albums.isEmpty {
            LoadingView()
        } else if viewModel.albums.isEmpty {
            EmptyStateView(icon: "photo.on.rectangle", title: "No albums")
        } else {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(viewModel.albums) { album in
                        AlbumCard(album: album, coverUrl: viewModel.coverUrl(for: album)) {
                            onNavigateToAlbum(album.id)
                        }
                    }
                }
                .padding()
            }
            .refreshable { await viewModel.loadAlbums() }
        }
    }
}

private struct AlbumCard: View {
    let album: PhotoAlbum
    let coverUrl: URL?
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 6) {
                // Cover photo
                AsyncImage(url: coverUrl) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().aspectRatio(1, contentMode: .fill)
                    case .failure:
                        placeholder
                    default:
                        placeholder
                    }
                }
                .frame(maxWidth: .infinity)
                .aspectRatio(1, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 10))

                Text(album.name)
                    .font(.subheadline).bold()
                    .lineLimit(1)
                Text("\(album.photoCount) photos")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .buttonStyle(.plain)
    }

    private var placeholder: some View {
        Rectangle()
            .fill(Color(.tertiarySystemGroupedBackground))
            .aspectRatio(1, contentMode: .fit)
            .overlay {
                Image(systemName: "photo")
                    .font(.largeTitle)
                    .foregroundStyle(.secondary)
            }
    }
}
