import Foundation

struct Recipe: Identifiable, Codable, Sendable, Equatable {
    let id: String
    let title: String
    let description: String?
    let servings: Int?
    let prepTime: Int?
    let cookTime: Int?
    let ingredients: [RecipeIngredient]
    let instructions: [String]
    let tags: [String]
    let notes: String?
    let sourceImagePath: String?
    let thumbnailPath: String?
    let isFavorite: Bool

    var totalTime: Int? {
        if let prep = prepTime, let cook = cookTime { return prep + cook }
        return prepTime ?? cookTime
    }
}

struct RecipeIngredient: Codable, Sendable, Equatable, Identifiable {
    var id: String { "\(name)-\(amount)-\(unit)" }
    let name: String
    let amount: String
    let unit: String

    var displayText: String {
        var parts: [String] = []
        if !amount.isEmpty { parts.append(amount) }
        if !unit.isEmpty { parts.append(unit) }
        parts.append(name)
        return parts.joined(separator: " ")
    }
}
