import Foundation

struct Recipe: Identifiable, Codable {
    let id: String
    var title: String
    var description: String?
    var servings: Int?
    var prepTime: Int?
    var cookTime: Int?
    var ingredients: [RecipeIngredient]?
    var instructions: [String]?
    var tags: [String]?
    var notes: String?
    var sourceImagePath: String?
    var isFavorite: Bool?
    var imageUrl: String?

    var totalTime: Int? {
        guard let prep = prepTime, let cook = cookTime else { return prepTime ?? cookTime }
        return prep + cook
    }
}

struct RecipeIngredient: Codable, Identifiable {
    var id: String { item ?? UUID().uuidString }
    var item: String?
    var name: String?
    var amount: Double?
    var unit: String?
    var optional: Bool?

    var displayName: String { item ?? name ?? "Unknown" }
}
