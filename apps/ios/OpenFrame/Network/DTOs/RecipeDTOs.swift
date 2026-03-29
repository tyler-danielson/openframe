import Foundation

struct RecipeDTO: Decodable {
    let id: String
    let title: String?
    let description: String?
    let servings: Int?
    let prepTime: Int?
    let cookTime: Int?
    let ingredients: [RecipeIngredientDTO]?
    let instructions: [String]?
    let tags: [String]?
    let notes: String?
    let sourceImagePath: String?
    let thumbnailPath: String?
    let isFavorite: Bool?
    let createdAt: String?
    let updatedAt: String?

    func toDomain() -> Recipe {
        Recipe(
            id: id,
            title: title ?? "Untitled Recipe",
            description: description,
            servings: servings,
            prepTime: prepTime,
            cookTime: cookTime,
            ingredients: (ingredients ?? []).map { $0.toDomain() },
            instructions: instructions ?? [],
            tags: tags ?? [],
            notes: notes,
            sourceImagePath: sourceImagePath,
            thumbnailPath: thumbnailPath,
            isFavorite: isFavorite ?? false
        )
    }
}

struct RecipeIngredientDTO: Decodable {
    let name: String?
    let amount: String?
    let unit: String?

    func toDomain() -> RecipeIngredient {
        RecipeIngredient(
            name: name ?? "",
            amount: amount ?? "",
            unit: unit ?? ""
        )
    }
}

struct CreateRecipeRequest: Encodable {
    let title: String
    let description: String?
    let servings: Int?
    let prepTime: Int?
    let cookTime: Int?
    let ingredients: [RecipeIngredientRequest]?
    let instructions: [String]?
    let tags: [String]?
    let notes: String?
}

struct RecipeIngredientRequest: Encodable {
    let name: String
    let amount: String
    let unit: String
}

struct UploadTokenResponse: Decodable {
    let token: String
    let expiresAt: String?
}
