import SwiftUI

struct AddRecipeView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.presentationMode) var presentationMode

    @State private var title = ""
    @State private var description = ""
    @State private var prepTime = ""
    @State private var cookTime = ""
    @State private var servings = ""
    @State private var ingredients: [EditableIngredient] = [EditableIngredient()]
    @State private var instructions: [String] = [""]
    @State private var tagsText = ""
    @State private var notes = ""
    @State private var isSaving = false

    private var palette: ThemePalette {
        appState.themeManager.palette
    }

    private var canSave: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty && !isSaving
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Title
                VStack(alignment: .leading, spacing: 4) {
                    Text("Title *")
                        .font(Font.caption.bold())
                        .foregroundStyle(.secondary)
                    TextField("Recipe name", text: $title)
                        .textFieldStyle(.roundedBorder)
                }

                // Description
                VStack(alignment: .leading, spacing: 4) {
                    Text("Description")
                        .font(Font.caption.bold())
                        .foregroundStyle(.secondary)
                    TextEditor(text: $description)
                        .frame(minHeight: 60)
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(Color(.systemGray4), lineWidth: 1)
                        )
                }

                // Time & Servings
                HStack(spacing: 12) {
                    NumberField(label: "Prep (min)", text: $prepTime)
                    NumberField(label: "Cook (min)", text: $cookTime)
                    NumberField(label: "Servings", text: $servings)
                }

                // Ingredients
                VStack(alignment: .leading, spacing: 8) {
                    Text("Ingredients")
                        .font(Font.caption.bold())
                        .foregroundStyle(.secondary)

                    ForEach(ingredients.indices, id: \.self) { index in
                        HStack(spacing: 6) {
                            TextField("Amt", text: $ingredients[index].amount)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 50)
                            TextField("Unit", text: $ingredients[index].unit)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 60)
                            TextField("Ingredient", text: $ingredients[index].name)
                                .textFieldStyle(.roundedBorder)

                            if ingredients.count > 1 {
                                Button(action: { ingredients.remove(at: index) }) {
                                    Image(systemName: "minus.circle.fill")
                                        .foregroundColor(.red.opacity(0.7))
                                }
                            }
                        }
                    }

                    Button(action: { ingredients.append(EditableIngredient()) }) {
                        HStack {
                            Image(systemName: "plus.circle.fill")
                            Text("Add Ingredient")
                        }
                        .font(.caption)
                        .foregroundColor(palette.primary)
                    }
                }

                // Instructions
                VStack(alignment: .leading, spacing: 8) {
                    Text("Instructions")
                        .font(Font.caption.bold())
                        .foregroundStyle(.secondary)

                    ForEach(instructions.indices, id: \.self) { index in
                        HStack(alignment: .top, spacing: 8) {
                            Text("\(index + 1).")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .padding(.top, 8)

                            TextEditor(text: $instructions[index])
                                .frame(minHeight: 44)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 6)
                                        .stroke(Color(.systemGray4), lineWidth: 1)
                                )

                            if instructions.count > 1 {
                                Button(action: { instructions.remove(at: index) }) {
                                    Image(systemName: "minus.circle.fill")
                                        .foregroundColor(.red.opacity(0.7))
                                }
                                .padding(.top, 8)
                            }
                        }
                    }

                    Button(action: { instructions.append("") }) {
                        HStack {
                            Image(systemName: "plus.circle.fill")
                            Text("Add Step")
                        }
                        .font(.caption)
                        .foregroundColor(palette.primary)
                    }
                }

                // Tags
                VStack(alignment: .leading, spacing: 4) {
                    Text("Tags (comma-separated)")
                        .font(Font.caption.bold())
                        .foregroundStyle(.secondary)
                    TextField("dinner, easy, vegetarian...", text: $tagsText)
                        .textFieldStyle(.roundedBorder)
                }

                // Notes
                VStack(alignment: .leading, spacing: 4) {
                    Text("Notes")
                        .font(Font.caption.bold())
                        .foregroundStyle(.secondary)
                    TextEditor(text: $notes)
                        .frame(minHeight: 60)
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(Color(.systemGray4), lineWidth: 1)
                        )
                }
            }
            .padding()
        }
        .navigationBarTitle("New Recipe", displayMode: .inline)
        .toolbar {
            ToolbarItemGroup(placement: .navigationBarTrailing) {
                if isSaving {
                    ProgressView()
                } else {
                    Button("Save") {
                        Task { await saveRecipe() }
                    }
                    .disabled(!canSave)
                }
            }
        }
    }

    private func saveRecipe() async {
        isSaving = true

        let filteredIngredients = ingredients
            .filter { !$0.name.trimmingCharacters(in: .whitespaces).isEmpty }
            .map { RecipeIngredientRequest(name: $0.name, amount: $0.amount, unit: $0.unit) }

        let filteredInstructions = instructions
            .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }

        let filteredTags = tagsText
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces).lowercased() }
            .filter { !$0.isEmpty }

        let request = CreateRecipeRequest(
            title: title.trimmingCharacters(in: .whitespaces),
            description: description.isEmpty ? nil : description,
            servings: Int(servings),
            prepTime: Int(prepTime),
            cookTime: Int(cookTime),
            ingredients: filteredIngredients.isEmpty ? nil : filteredIngredients,
            instructions: filteredInstructions.isEmpty ? nil : filteredInstructions,
            tags: filteredTags.isEmpty ? nil : filteredTags,
            notes: notes.isEmpty ? nil : notes
        )

        let result = await appState.recipeRepository.createRecipe(request)
        isSaving = false

        if case .success = result {
            presentationMode.wrappedValue.dismiss()
        }
    }
}

// MARK: - Supporting Types

private struct EditableIngredient {
    var amount = ""
    var unit = ""
    var name = ""
}

private struct NumberField: View {
    let label: String
    @Binding var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(Font.caption.bold())
                .foregroundStyle(.secondary)
            TextField("0", text: $text)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.numberPad)
        }
    }
}
