import Foundation

@MainActor
final class RecipesViewModel: ObservableObject {
    private let repository: RecipeRepository

    @Published var recipes: [Recipe] = []
    @Published var tags: [String] = []
    @Published var selectedTag: String?
    @Published var searchQuery: String = ""
    @Published var isLoading = false
    @Published var errorMessage: String?

    init(repository: RecipeRepository) {
        self.repository = repository
    }

    var filteredRecipes: [Recipe] {
        guard !searchQuery.isEmpty else { return recipes }
        let query = searchQuery.lowercased()
        return recipes.filter { recipe in
            recipe.title.lowercased().contains(query) ||
            (recipe.description?.lowercased().contains(query) ?? false) ||
            recipe.tags.contains(where: { $0.lowercased().contains(query) })
        }
    }

    @MainActor
    func loadRecipes() async {
        isLoading = recipes.isEmpty
        errorMessage = nil

        let result = await repository.getRecipes(tag: selectedTag)
        switch result {
        case .success(let recipes):
            self.recipes = recipes
        case .failure(let error):
            self.errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    @MainActor
    func loadTags() async {
        let result = await repository.getTags()
        if case .success(let tags) = result {
            self.tags = tags
        }
    }

    @MainActor
    func toggleTag(_ tag: String) {
        if selectedTag == tag {
            selectedTag = nil
        } else {
            selectedTag = tag
        }
        Task { await loadRecipes() }
    }

    @MainActor
    func toggleFavorite(_ id: String) async {
        let result = await repository.toggleFavorite(id: id)
        if case .success(let updated) = result {
            if let index = recipes.firstIndex(where: { $0.id == id }) {
                recipes[index] = updated
            }
        }
    }

    @MainActor
    func deleteRecipe(_ id: String) async -> Bool {
        let result = await repository.deleteRecipe(id: id)
        if case .success = result {
            recipes.removeAll { $0.id == id }
            return true
        }
        return false
    }

    func imageUrl(for path: String?) -> URL? {
        repository.imageUrl(for: path)
    }
}
