import SwiftUI

struct RecipeDetailView: View {
    let recipeId: String
    @EnvironmentObject var container: DIContainer
    @State private var recipe: Recipe?
    @State private var isLoading = true
    @Environment(\.presentationMode) var presentationMode

    var body: some View {
        let palette = container.themeManager.palette
        Group {
            if let recipe {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        // Title + meta
                        Text(recipe.title)
                            .font(.title2.bold())
                            .foregroundStyle(palette.foreground)

                        if let desc = recipe.description, !desc.isEmpty {
                            Text(desc)
                                .font(.subheadline)
                                .foregroundStyle(palette.mutedForeground)
                        }

                        // Meta row
                        HStack(spacing: 16) {
                            if let prep = recipe.prepTime {
                                MetaItem(icon: "clock", label: "Prep", value: "\(prep)m", palette: palette)
                            }
                            if let cook = recipe.cookTime {
                                MetaItem(icon: "flame", label: "Cook", value: "\(cook)m", palette: palette)
                            }
                            if let servings = recipe.servings {
                                MetaItem(icon: "person.2", label: "Serves", value: "\(servings)", palette: palette)
                            }
                        }

                        // Tags
                        if let tags = recipe.tags, !tags.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(tags, id: \.self) { tag in
                                        Text(tag)
                                            .font(.caption)
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 4)
                                            .background(palette.primary.opacity(0.1))
                                            .foregroundStyle(palette.primary)
                                            .cornerRadius(12)
                                    }
                                }
                            }
                        }

                        // Ingredients
                        if let ingredients = recipe.ingredients, !ingredients.isEmpty {
                            Text("Ingredients")
                                .font(.headline)
                                .foregroundStyle(palette.foreground)

                            ForEach(ingredients) { ing in
                                HStack(spacing: 8) {
                                    Circle()
                                        .fill(palette.primary)
                                        .frame(width: 6, height: 6)
                                    if let amount = ing.amount {
                                        Text("\(amount, specifier: "%.4g")")
                                            .font(.subheadline.weight(.medium))
                                            .foregroundStyle(palette.foreground)
                                    }
                                    if let unit = ing.unit {
                                        Text(unit)
                                            .font(.subheadline)
                                            .foregroundStyle(palette.mutedForeground)
                                    }
                                    Text(ing.displayName)
                                        .font(.subheadline)
                                        .foregroundStyle(palette.foreground)
                                    Spacer()
                                }
                            }
                        }

                        // Instructions
                        if let instructions = recipe.instructions, !instructions.isEmpty {
                            Text("Instructions")
                                .font(.headline)
                                .foregroundStyle(palette.foreground)

                            ForEach(Array(instructions.enumerated()), id: \.offset) { index, step in
                                HStack(alignment: .top, spacing: 12) {
                                    Text("\(index + 1)")
                                        .font(.caption.bold())
                                        .foregroundStyle(palette.primaryForeground)
                                        .frame(width: 24, height: 24)
                                        .background(palette.primary)
                                        .cornerRadius(12)

                                    Text(step)
                                        .font(.subheadline)
                                        .foregroundStyle(palette.foreground)
                                }
                            }
                        }

                        // Notes
                        if let notes = recipe.notes, !notes.isEmpty {
                            Text("Notes")
                                .font(.headline)
                                .foregroundStyle(palette.foreground)
                            Text(notes)
                                .font(.subheadline)
                                .foregroundStyle(palette.mutedForeground)
                        }
                    }
                    .padding()
                }
            } else if isLoading {
                LoadingView()
            }
        }
        .background(palette.background.ignoresSafeArea())
        .navigationTitle("Recipe")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            recipe = try? await container.recipeRepository.getRecipe(id: recipeId)
            isLoading = false
        }
    }
}

private struct MetaItem: View {
    let icon: String
    let label: String
    let value: String
    let palette: ThemePalette

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(palette.primary)
            Text(value)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(palette.foreground)
            Text(label)
                .font(.caption)
                .foregroundStyle(palette.mutedForeground)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(palette.secondary)
        .cornerRadius(10)
    }
}
