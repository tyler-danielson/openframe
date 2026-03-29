import Foundation

final class RecipeDetailViewModel: ObservableObject {
    private let recipeId: String
    private let repository: RecipeRepository

    @Published var recipe: Recipe?
    @Published var isLoading = false
    @Published var errorMessage: String?

    init(recipeId: String, repository: RecipeRepository) {
        self.recipeId = recipeId
        self.repository = repository
    }

    @MainActor
    func loadRecipe() async {
        isLoading = true
        errorMessage = nil

        let result = await repository.getRecipe(id: recipeId)
        switch result {
        case .success(let recipe):
            self.recipe = recipe
        case .failure(let error):
            self.errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    @MainActor
    func toggleFavorite() async {
        guard let recipe = recipe else { return }
        let result = await repository.toggleFavorite(id: recipe.id)
        if case .success(let updated) = result {
            self.recipe = updated
        }
    }

    @MainActor
    func deleteRecipe() async -> Bool {
        guard let recipe = recipe else { return false }
        let result = await repository.deleteRecipe(id: recipe.id)
        return result.isSuccess
    }

    func imageUrl() -> URL? {
        guard let recipe = recipe else { return nil }
        return repository.imageUrl(for: recipe.sourceImagePath ?? recipe.thumbnailPath)
    }
}

private extension Result {
    var isSuccess: Bool {
        if case .success = self { return true }
        return false
    }
}
