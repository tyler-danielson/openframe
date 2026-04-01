import SwiftUI

struct AddRecipeView: View {
    var onCreated: (() -> Void)?
    @EnvironmentObject var container: DIContainer
    @Environment(\.presentationMode) var presentationMode
    @State private var title = ""
    @State private var description = ""
    @State private var servings = ""
    @State private var prepTime = ""
    @State private var cookTime = ""
    @State private var ingredientsText = ""
    @State private var instructionsText = ""
    @State private var tags = ""
    @State private var notes = ""
    @State private var isSaving = false
    @State private var error: String?

    var body: some View {
        let palette = container.themeManager.palette
        Form {
            Section("Details") {
                TextField("Recipe title", text: $title)
                TextField("Description", text: $description)
            }

            Section("Timing") {
                TextField("Prep time (minutes)", text: $prepTime)
                    .keyboardType(.numberPad)
                TextField("Cook time (minutes)", text: $cookTime)
                    .keyboardType(.numberPad)
                TextField("Servings", text: $servings)
                    .keyboardType(.numberPad)
            }

            Section("Ingredients (one per line)") {
                TextEditor(text: $ingredientsText)
                    .frame(minHeight: 100)
            }

            Section("Instructions (one step per line)") {
                TextEditor(text: $instructionsText)
                    .frame(minHeight: 100)
            }

            Section("Tags (comma separated)") {
                TextField("dinner, italian, quick", text: $tags)
            }

            Section("Notes") {
                TextEditor(text: $notes)
                    .frame(minHeight: 60)
            }

            if let error {
                Section {
                    Text(error).foregroundStyle(palette.destructive).font(.caption)
                }
            }
        }
        .navigationTitle("Add Recipe")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(content: {
            ToolbarItem(placement: .navigationBarLeading) {
                Button("Cancel") { presentationMode.wrappedValue.dismiss() }
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Save") { save() }
                    .disabled(title.isEmpty || isSaving)
            }
        })
    }

    private func save() {
        isSaving = true
        error = nil
        var body: [String: Any] = ["title": title]
        if !description.isEmpty { body["description"] = description }
        if let s = Int(servings) { body["servings"] = s }
        if let p = Int(prepTime) { body["prepTime"] = p }
        if let c = Int(cookTime) { body["cookTime"] = c }
        if !notes.isEmpty { body["notes"] = notes }

        let ingredients = ingredientsText.split(separator: "\n").map { line -> [String: Any] in
            ["item": String(line).trimmingCharacters(in: .whitespaces)]
        }
        if !ingredients.isEmpty { body["ingredients"] = ingredients }

        let instructions = instructionsText.split(separator: "\n").map { String($0).trimmingCharacters(in: .whitespaces) }
        if !instructions.isEmpty { body["instructions"] = instructions }

        let tagList = tags.split(separator: ",").map { String($0).trimmingCharacters(in: .whitespaces) }
        if !tagList.isEmpty { body["tags"] = tagList }

        Task {
            do {
                _ = try await container.recipeRepository.createRecipe(body)
                onCreated?()
                presentationMode.wrappedValue.dismiss()
            } catch {
                self.error = error.localizedDescription
            }
            isSaving = false
        }
    }
}
