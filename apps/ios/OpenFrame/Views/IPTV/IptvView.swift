import SwiftUI
import Kingfisher

struct IptvView: View {
    @EnvironmentObject var container: DIContainer
    @State private var channels: [IptvChannel] = []
    @State private var favorites: [IptvChannel] = []
    @State private var categories: [IptvCategory] = []
    @State private var selectedCategory: String?
    @State private var searchText = ""
    @State private var isLoading = true

    var body: some View {
        let palette = container.themeManager.palette
        Group {
            if channels.isEmpty && favorites.isEmpty && !isLoading {
                EmptyStateView(icon: "play.tv", title: "No Channels", message: "IPTV is not configured")
            } else {
                List {
                    // Favorites section
                    if !favorites.isEmpty {
                        Section("Favorites") {
                            ForEach(favorites) { channel in
                                ChannelRow(channel: channel)
                            }
                        }
                    }

                    // Category filter
                    if !categories.isEmpty {
                        Section {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    CategoryPill(title: "All", isSelected: selectedCategory == nil, palette: palette) {
                                        selectedCategory = nil
                                        Task { await loadChannels() }
                                    }
                                    ForEach(categories) { cat in
                                        CategoryPill(title: cat.name, isSelected: selectedCategory == cat.id, palette: palette) {
                                            selectedCategory = cat.id
                                            Task { await loadChannels() }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Channels
                    Section("Channels") {
                        ForEach(filteredChannels) { channel in
                            ChannelRow(channel: channel)
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .background(palette.background.ignoresSafeArea())
        .navigationTitle("IPTV")
        .searchable(text: $searchText, prompt: "Search channels")
        .task { await loadData() }
        .refreshable { await loadData() }
    }

    private var filteredChannels: [IptvChannel] {
        if searchText.isEmpty { return channels }
        return channels.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    private func loadData() async {
        isLoading = true
        async let fav = container.iptvRepository.getFavorites()
        async let cats = container.iptvRepository.getCategories()
        favorites = (try? await fav) ?? []
        categories = (try? await cats) ?? []
        await loadChannels()
        isLoading = false
    }

    private func loadChannels() async {
        channels = (try? await container.iptvRepository.getChannels(group: selectedCategory)) ?? []
    }
}

private struct ChannelRow: View {
    let channel: IptvChannel
    @EnvironmentObject var container: DIContainer

    var body: some View {
        let palette = container.themeManager.palette
        HStack(spacing: 12) {
            if let logo = channel.logo, let url = URL(string: logo) {
                KFImage(url)
                    .resizable()
                    .placeholder { palette.secondary }
                    .frame(width: 40, height: 40)
                    .cornerRadius(6)
            } else {
                RoundedRectangle(cornerRadius: 6)
                    .fill(palette.secondary)
                    .frame(width: 40, height: 40)
                    .overlay(Image(systemName: "play.tv").font(.caption).foregroundStyle(palette.mutedForeground))
            }

            Text(channel.name)
                .font(.subheadline)
                .foregroundStyle(palette.foreground)

            Spacer()

            if channel.isFavorite == true {
                Image(systemName: "star.fill")
                    .font(.caption)
                    .foregroundStyle(palette.primary)
            }
        }
    }
}

private struct CategoryPill: View {
    let title: String
    let isSelected: Bool
    let palette: ThemePalette
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? palette.primary : palette.secondary)
                .foregroundStyle(isSelected ? palette.primaryForeground : palette.foreground)
                .cornerRadius(16)
        }
    }
}
