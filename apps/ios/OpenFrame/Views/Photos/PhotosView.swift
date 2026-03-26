import SwiftUI

struct PhotosView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel: PhotosViewModel?

    var onNavigateToAlbum: (String) -> Void

    private let columns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        Group {
            if let vm = viewModel {
                photosContent(vm)
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

    @ViewBuilder
    private func photosContent(_ vm: PhotosViewModel) -> some View {
        if vm.isLoading && vm.albums.isEmpty {
            LoadingView()
        } else if vm.albums.isEmpty {
            EmptyStateView(icon: "photo.on.rectangle", title: "No albums")
        } else {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(vm.albums) { album in
                        AlbumCard(album: album, coverUrl: vm.coverUrl(for: album)) {
                            onNavigateToAlbum(album.id)
                        }
                    }
                }
                .padding()
            }
            .refreshable { await vm.loadAlbums() }
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
