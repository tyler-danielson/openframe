import SwiftUI
import Kingfisher

struct PhotosView: View {
    @EnvironmentObject var container: DIContainer
    @State private var albums: [PhotoAlbum] = []
    @State private var isLoading = true

    var body: some View {
        let palette = container.themeManager.palette
        Group {
            if albums.isEmpty && !isLoading {
                EmptyStateView(icon: "photo.on.rectangle", title: "No Albums", message: "No photo albums found")
            } else {
                ScrollView {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                        ForEach(albums) { album in
                            NavigationLink(destination: AlbumDetailView(album: album)) {
                                VStack(alignment: .leading, spacing: 8) {
                                    RoundedRectangle(cornerRadius: 12)
                                        .fill(palette.secondary)
                                        .aspectRatio(1, contentMode: .fit)
                                        .overlay(
                                            Image(systemName: "photo")
                                                .font(.title)
                                                .foregroundStyle(palette.mutedForeground)
                                        )

                                    Text(album.name)
                                        .font(.subheadline.weight(.medium))
                                        .foregroundStyle(palette.foreground)
                                        .lineLimit(1)

                                    Text("\(album.photoCount ?? 0) photos")
                                        .font(.caption)
                                        .foregroundStyle(palette.mutedForeground)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding()
                }
            }
        }
        .background(palette.background.ignoresSafeArea())
        .navigationTitle("Photos")
        .task { await loadAlbums() }
        .refreshable { await loadAlbums() }
    }

    private func loadAlbums() async {
        isLoading = true
        albums = (try? await container.photoRepository.getAlbums()) ?? []
        isLoading = false
    }
}
