import SwiftUI

struct RecipeDetailView: View {
    let recipeId: String
    @EnvironmentObject private var appState: AppState

    var body: some View {
        RecipeDetailContentView(
            viewModel: RecipeDetailViewModel(recipeId: recipeId, repository: appState.recipeRepository)
        )
    }
}

private struct RecipeDetailContentView: View {
    @ObservedObject var viewModel: RecipeDetailViewModel
    @EnvironmentObject private var appState: AppState
    @Environment(\.presentationMode) var presentationMode

    @State private var checkedIngredients: Set<String> = []
    @State private var checkedInstructions: Set<Int> = []
    @State private var showDeleteConfirm = false

    private var palette: ColorPalette {
        appState.themeManager.palette
    }

    var body: some View {
        Group {
            if viewModel.isLoading {
                LoadingView()
            } else if let error = viewModel.errorMessage {
                ErrorView(message: error) {
                    Task { await viewModel.loadRecipe() }
                }
            } else if let recipe = viewModel.recipe {
                recipeContent(recipe)
            }
        }
        .navigationBarTitle("", displayMode: .inline)
        .toolbar {
            ToolbarItemGroup(placement: .navigationBarTrailing) {
                if let recipe = viewModel.recipe {
                    Button(action: {
                        Task { await viewModel.toggleFavorite() }
                    }) {
                        Image(systemName: recipe.isFavorite ? "heart.fill" : "heart")
                            .foregroundColor(recipe.isFavorite ? .red : palette.foreground)
                    }

                    Button(action: { showDeleteConfirm = true }) {
                        Image(systemName: "trash")
                            .foregroundColor(.red)
                    }
                }
            }
        }
        .alert(isPresented: $showDeleteConfirm) {
            Alert(
                title: Text("Delete Recipe"),
                message: Text("Are you sure you want to delete this recipe? This cannot be undone."),
                primaryButton: .destructive(Text("Delete")) {
                    Task {
                        let deleted = await viewModel.deleteRecipe()
                        if deleted {
                            presentationMode.wrappedValue.dismiss()
                        }
                    }
                },
                secondaryButton: .cancel()
            )
        }
        .task {
            await viewModel.loadRecipe()
        }
    }

    @ViewBuilder
    private func recipeContent(_ recipe: Recipe) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Hero image
                if let url = viewModel.imageUrl() {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().aspectRatio(contentMode: .fill)
                        default:
                            Color(.systemGray5)
                                .overlay(
                                    Image(systemName: "book.closed")
                                        .font(.system(size: 40))
                                        .foregroundStyle(.secondary)
                                )
                        }
                    }
                    .frame(height: 240)
                    .frame(maxWidth: .infinity)
                    .clipped()
                    .cornerRadius(12)
                }

                // Title
                Text(recipe.title)
                    .font(Font.title2.bold())
                    .foregroundStyle(palette.foreground)

                // Description
                if let desc = recipe.description, !desc.isEmpty {
                    Text(desc)
                        .font(.body)
                        .foregroundStyle(.secondary)
                }

                // Metadata badges
                HStack(spacing: 12) {
                    if let prep = recipe.prepTime {
                        MetadataBadge(icon: "clock", label: "Prep", value: "\(prep)m", palette: palette)
                    }
                    if let cook = recipe.cookTime {
                        MetadataBadge(icon: "flame", label: "Cook", value: "\(cook)m", palette: palette)
                    }
                    if let total = recipe.totalTime {
                        MetadataBadge(icon: "timer", label: "Total", value: "\(total)m", palette: palette)
                    }
                    if let servings = recipe.servings {
                        MetadataBadge(icon: "person.2", label: "Serves", value: "\(servings)", palette: palette)
                    }
                }

                // Tags
                if !recipe.tags.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(recipe.tags, id: \.self) { tag in
                                Text(tag)
                                    .font(.caption)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 4)
                                    .background(palette.primary.opacity(0.15))
                                    .foregroundColor(palette.primary)
                                    .cornerRadius(12)
                            }
                        }
                    }
                }

                // Ingredients
                if !recipe.ingredients.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Ingredients")
                            .font(Font.headline.bold())
                            .foregroundStyle(palette.foreground)

                        ForEach(recipe.ingredients) { ingredient in
                            IngredientRow(
                                ingredient: ingredient,
                                isChecked: checkedIngredients.contains(ingredient.id),
                                palette: palette
                            ) {
                                if checkedIngredients.contains(ingredient.id) {
                                    checkedIngredients.remove(ingredient.id)
                                } else {
                                    checkedIngredients.insert(ingredient.id)
                                }
                            }
                        }
                    }
                }

                // Instructions
                if !recipe.instructions.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Instructions")
                            .font(Font.headline.bold())
                            .foregroundStyle(palette.foreground)

                        ForEach(Array(recipe.instructions.enumerated()), id: \.offset) { index, instruction in
                            InstructionRow(
                                stepNumber: index + 1,
                                instruction: instruction,
                                isChecked: checkedInstructions.contains(index),
                                palette: palette
                            ) {
                                if checkedInstructions.contains(index) {
                                    checkedInstructions.remove(index)
                                } else {
                                    checkedInstructions.insert(index)
                                }
                            }
                        }
                    }
                }

                // Notes
                if let notes = recipe.notes, !notes.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Notes")
                            .font(Font.headline.bold())
                            .foregroundStyle(palette.foreground)

                        Text(notes)
                            .font(.body)
                            .foregroundStyle(.secondary)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color(.systemGray6))
                            .cornerRadius(8)
                    }
                }
            }
            .padding()
        }
    }
}

// MARK: - Supporting Views

private struct MetadataBadge: View {
    let icon: String
    let label: String
    let value: String
    let palette: ColorPalette

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundStyle(palette.primary)
            Text(value)
                .font(Font.caption.bold())
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(minWidth: 60)
        .padding(.vertical, 8)
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
}

private struct IngredientRow: View {
    let ingredient: RecipeIngredient
    let isChecked: Bool
    let palette: ColorPalette
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            HStack(spacing: 12) {
                Image(systemName: isChecked ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(isChecked ? palette.primary : .secondary)

                Text(ingredient.displayText)
                    .font(.body)
                    .strikethrough(isChecked)
                    .foregroundStyle(isChecked ? .secondary : palette.foreground)

                Spacer()
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
    }
}

private struct InstructionRow: View {
    let stepNumber: Int
    let instruction: String
    let isChecked: Bool
    let palette: ColorPalette
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            HStack(alignment: .top, spacing: 12) {
                ZStack {
                    Circle()
                        .fill(isChecked ? palette.primary : Color(.systemGray5))
                        .frame(width: 28, height: 28)
                    if isChecked {
                        Image(systemName: "checkmark")
                            .font(.caption2)
                            .foregroundColor(.white)
                    } else {
                        Text("\(stepNumber)")
                            .font(Font.caption.bold())
                            .foregroundColor(palette.foreground)
                    }
                }

                Text(instruction)
                    .font(.body)
                    .strikethrough(isChecked)
                    .foregroundStyle(isChecked ? .secondary : palette.foreground)
                    .multilineTextAlignment(.leading)

                Spacer()
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
    }
}
