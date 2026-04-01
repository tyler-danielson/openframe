import SwiftUI

struct RecipesView: View {
    @EnvironmentObject var container: DIContainer
    @State private var recipes: [Recipe] = []
    @State private var searchText = ""
    @State private var isLoading = true
    @State private var showAddRecipe = false

    var body: some View {
        let palette = container.themeManager.palette
        Group {
            if filteredRecipes.isEmpty && !isLoading {
                EmptyStateView(
                    icon: "book.closed",
                    title: "No Recipes",
                    message: "Add your first recipe",
                    actionTitle: "Add Recipe",
                    action: { showAddRecipe = true }
                )
            } else {
                ScrollView {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                        ForEach(filteredRecipes) { recipe in
                            NavigationLink(destination: RecipeDetailView(recipeId: recipe.id)) {
                                RecipeCard(recipe: recipe)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding()
                }
            }
        }
        .background(palette.background.ignoresSafeArea())
        .navigationTitle("Recipes")
        .searchable(text: $searchText, prompt: "Search recipes")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { showAddRecipe = true } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showAddRecipe) {
            NavigationView {
                AddRecipeView {
                    Task { await loadRecipes() }
                }
            }
        }
        .task { await loadRecipes() }
        .refreshable { await loadRecipes() }
    }

    private var filteredRecipes: [Recipe] {
        if searchText.isEmpty { return recipes }
        return recipes.filter { $0.title.localizedCaseInsensitiveContains(searchText) }
    }

    private func loadRecipes() async {
        isLoading = true
        recipes = (try? await container.recipeRepository.getRecipes()) ?? []
        isLoading = false
    }
}

private struct RecipeCard: View {
    let recipe: Recipe
    @EnvironmentObject var container: DIContainer

    var body: some View {
        let palette = container.themeManager.palette
        VStack(alignment: .leading, spacing: 8) {
            RoundedRectangle(cornerRadius: 12)
                .fill(palette.secondary)
                .aspectRatio(1.3, contentMode: .fit)
                .overlay(
                    Image(systemName: "book.closed")
                        .font(.title2)
                        .foregroundStyle(palette.mutedForeground)
                )

            Text(recipe.title)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(palette.foreground)
                .lineLimit(2)

            HStack(spacing: 8) {
                if let time = recipe.totalTime {
                    HStack(spacing: 2) {
                        Image(systemName: "clock").font(.caption2)
                        Text("\(time)m").font(.caption)
                    }
                    .foregroundStyle(palette.mutedForeground)
                }
                if let servings = recipe.servings {
                    HStack(spacing: 2) {
                        Image(systemName: "person.2").font(.caption2)
                        Text("\(servings)").font(.caption)
                    }
                    .foregroundStyle(palette.mutedForeground)
                }
            }
        }
    }
}
