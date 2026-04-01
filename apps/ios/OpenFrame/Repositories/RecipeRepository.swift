import Foundation

final class RecipeRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func getRecipes(search: String? = nil, tags: String? = nil) async throws -> [Recipe] {
        try await apiClient.request(.getRecipes(search: search, tags: tags))
    }

    func getRecipe(id: String) async throws -> Recipe {
        try await apiClient.request(.getRecipe(id: id))
    }

    func createRecipe(_ recipe: [String: Any]) async throws -> Recipe {
        try await apiClient.request(.createRecipe(body: recipe))
    }

    func updateRecipe(id: String, updates: [String: Any]) async throws -> Recipe {
        try await apiClient.request(.updateRecipe(id: id, body: updates))
    }

    func deleteRecipe(id: String) async throws {
        try await apiClient.requestVoid(.deleteRecipe(id: id))
    }

    func getTags() async throws -> [String] {
        try await apiClient.request(.getRecipeTags)
    }

    func uploadImage(recipeId: String, imageData: Data) async throws {
        try await apiClient.uploadVoid(
            path: "/api/v1/recipes/\(recipeId)/image",
            fileData: imageData,
            fileName: "recipe.jpg",
            mimeType: "image/jpeg"
        )
    }
}
