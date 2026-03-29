import SwiftUI

struct RecipesView: View {
    @EnvironmentObject private var appState: AppState
    var onNavigateToRecipe: (String) -> Void
    var onNavigateToAddRecipe: () -> Void
    var onNavigateToScanRecipe: () -> Void

    var body: some View {
        RecipesContentView(
            viewModel: RecipesViewModel(repository: appState.recipeRepository),
            onNavigateToRecipe: onNavigateToRecipe,
            onNavigateToAddRecipe: onNavigateToAddRecipe,
            onNavigateToScanRecipe: onNavigateToScanRecipe
        )
    }
}

private struct RecipesContentView: View {
    @ObservedObject var viewModel: RecipesViewModel
    @EnvironmentObject private var appState: AppState
    var onNavigateToRecipe: (String) -> Void
    var onNavigateToAddRecipe: () -> Void
    var onNavigateToScanRecipe: () -> Void

    @State private var showingAddMenu = false

    private var palette: ThemePalette {
        appState.themeManager.palette
    }

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                // Search bar
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                    TextField("Search recipes...", text: $viewModel.searchQuery)
                        .textFieldStyle(.plain)
                    if !viewModel.searchQuery.isEmpty {
                        Button(action: { viewModel.searchQuery = "" }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .padding(10)
                .background(Color(.systemGray6))
                .cornerRadius(10)
                .padding(.horizontal)
                .padding(.top, 8)

                // Tag chips
                if !viewModel.tags.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(viewModel.tags.prefix(8), id: \.self) { tag in
                                TagChip(
                                    tag: tag,
                                    isSelected: viewModel.selectedTag == tag,
                                    palette: palette,
                                    action: { viewModel.toggleTag(tag) }
                                )
                            }
                        }
                        .padding(.horizontal)
                        .padding(.vertical, 8)
                    }
                }

                // Content
                if viewModel.isLoading {
                    LoadingView()
                } else if let error = viewModel.errorMessage {
                    ErrorView(message: error) {
                        Task { await viewModel.loadRecipes() }
                    }
                } else if viewModel.filteredRecipes.isEmpty {
                    EmptyStateView(
                        icon: "book.closed",
                        title: "No Recipes Yet",
                        subtitle: "Add your first recipe by tapping +"
                    )
                } else {
                    ScrollView {
                        LazyVGrid(columns: columns, spacing: 12) {
                            ForEach(viewModel.filteredRecipes) { recipe in
                                RecipeCard(
                                    recipe: recipe,
                                    imageUrl: viewModel.imageUrl(for: recipe.thumbnailPath ?? recipe.sourceImagePath),
                                    palette: palette,
                                    onFavorite: {
                                        Task { await viewModel.toggleFavorite(recipe.id) }
                                    }
                                )
                                .onTapGesture {
                                    onNavigateToRecipe(recipe.id)
                                }
                            }
                        }
                        .padding()
                    }
                    .refreshable {
                        await viewModel.loadRecipes()
                        await viewModel.loadTags()
                    }
                }
            }

            // FAB
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    Menu {
                        Button(action: onNavigateToAddRecipe) {
                            Label("Write Recipe", systemImage: "square.and.pencil")
                        }
                        Button(action: onNavigateToScanRecipe) {
                            Label("Scan Recipe", systemImage: "camera")
                        }
                    } label: {
                        Image(systemName: "plus")
                            .font(.title2)
                            .foregroundColor(.white)
                            .frame(width: 56, height: 56)
                            .background(palette.primary)
                            .clipShape(Circle())
                            .shadow(radius: 4)
                    }
                    .padding(.trailing, 20)
                    .padding(.bottom, 20)
                }
            }
        }
        .task {
            await viewModel.loadRecipes()
            await viewModel.loadTags()
        }
    }
}

// MARK: - Recipe Card

private struct RecipeCard: View {
    let recipe: Recipe
    let imageUrl: URL?
    let palette: ThemePalette
    let onFavorite: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Image
            ZStack(alignment: .topTrailing) {
                if let url = imageUrl {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().aspectRatio(contentMode: .fill)
                        case .failure:
                            recipePlaceholder
                        default:
                            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                        }
                    }
                    .frame(height: 120)
                    .clipped()
                } else {
                    recipePlaceholder
                        .frame(height: 120)
                }

                // Favorite button
                Button(action: onFavorite) {
                    Image(systemName: recipe.isFavorite ? "heart.fill" : "heart")
                        .font(.caption)
                        .foregroundColor(recipe.isFavorite ? .red : .white)
                        .padding(6)
                        .background(Color.black.opacity(0.4))
                        .clipShape(Circle())
                }
                .padding(6)
            }
            .cornerRadius(10)

            // Title
            Text(recipe.title)
                .font(Font.subheadline.bold())
                .lineLimit(2)
                .foregroundStyle(palette.foreground)

            // Time
            if let totalTime = recipe.totalTime {
                HStack(spacing: 4) {
                    Image(systemName: "clock")
                        .font(.caption2)
                    Text("\(totalTime) min")
                        .font(.caption)
                }
                .foregroundStyle(.secondary)
            }
        }
    }

    private var recipePlaceholder: some View {
        ZStack {
            Color(.systemGray5)
            Image(systemName: "book.closed")
                .font(.title)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Tag Chip

private struct TagChip: View {
    let tag: String
    let isSelected: Bool
    let palette: ThemePalette
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(tag)
                .font(.caption)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? palette.primary : Color(.systemGray5))
                .foregroundColor(isSelected ? .white : palette.foreground)
                .cornerRadius(16)
        }
    }
}
