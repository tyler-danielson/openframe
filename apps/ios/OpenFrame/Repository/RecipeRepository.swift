import Foundation

final class RecipeRepository: Sendable {
    private let apiClient: APIClient
    private let keychainManager: KeychainManager

    init(apiClient: APIClient, keychainManager: KeychainManager) {
        self.apiClient = apiClient
        self.keychainManager = keychainManager
    }

    func getRecipes(favorite: Bool? = nil, tag: String? = nil) async -> Result<[Recipe], Error> {
        do {
            var query: [String: String] = [:]
            if let favorite = favorite, favorite { query["favorite"] = "true" }
            if let tag = tag, !tag.isEmpty { query["tag"] = tag }
            let dtos: [RecipeDTO] = try await apiClient.requestData(.get, path: "/api/v1/recipes", query: query.isEmpty ? nil : query)
            return .success(dtos.map { $0.toDomain() })
        } catch {
            return .failure(error)
        }
    }

    func getRecipe(id: String) async -> Result<Recipe, Error> {
        do {
            let dto: RecipeDTO = try await apiClient.requestData(.get, path: "/api/v1/recipes/\(id)")
            return .success(dto.toDomain())
        } catch {
            return .failure(error)
        }
    }

    func createRecipe(_ request: CreateRecipeRequest) async -> Result<Recipe, Error> {
        do {
            let dto: RecipeDTO = try await apiClient.requestData(.post, path: "/api/v1/recipes", body: request)
            return .success(dto.toDomain())
        } catch {
            return .failure(error)
        }
    }

    func updateRecipe(id: String, _ request: CreateRecipeRequest) async -> Result<Recipe, Error> {
        do {
            let dto: RecipeDTO = try await apiClient.requestData(.patch, path: "/api/v1/recipes/\(id)", body: request)
            return .success(dto.toDomain())
        } catch {
            return .failure(error)
        }
    }

    func deleteRecipe(id: String) async -> Result<Void, Error> {
        do {
            try await apiClient.requestVoid(.delete, path: "/api/v1/recipes/\(id)")
            return .success(())
        } catch {
            return .failure(error)
        }
    }

    func toggleFavorite(id: String) async -> Result<Recipe, Error> {
        do {
            let dto: RecipeDTO = try await apiClient.requestData(.post, path: "/api/v1/recipes/\(id)/favorite")
            return .success(dto.toDomain())
        } catch {
            return .failure(error)
        }
    }

    func getTags() async -> Result<[String], Error> {
        do {
            let tags: [String] = try await apiClient.requestData(.get, path: "/api/v1/recipes/tags")
            return .success(tags)
        } catch {
            return .failure(error)
        }
    }

    /// Upload recipe image via two-step token flow — returns AI-parsed recipe
    func uploadRecipeImage(imageData: Data, filename: String) async -> Result<Recipe, Error> {
        do {
            // Step 1: Get upload token
            let tokenResponse: UploadTokenResponse = try await apiClient.requestData(.post, path: "/api/v1/recipes/upload-token")

            // Step 2: Upload image with token (this triggers AI parsing on the server)
            let wrapper: ApiWrapper<RecipeDTO> = try await apiClient.uploadMultipart(
                path: "/api/v1/recipes/upload/\(tokenResponse.token)",
                fileData: imageData,
                fileName: filename,
                mimeType: "image/jpeg"
            )

            if let dto = wrapper.data {
                return .success(dto.toDomain())
            } else {
                return .failure(APIError.noData)
            }
        } catch {
            return .failure(error)
        }
    }

    /// Build an authenticated URL for loading recipe images
    func imageUrl(for path: String?) -> URL? {
        guard let path = path, let serverUrl = keychainManager.serverUrl else { return nil }
        var urlString = "\(serverUrl)/api/v1/recipes/image/\(path)"

        switch keychainManager.authMethod {
        case .bearer:
            if let token = keychainManager.accessToken {
                urlString += (urlString.contains("?") ? "&" : "?") + "token=\(token)"
            }
        case .apiKey:
            if let key = keychainManager.apiKey {
                urlString += (urlString.contains("?") ? "&" : "?") + "apiKey=\(key)"
            }
        }

        return URL(string: urlString)
    }
}
