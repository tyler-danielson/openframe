import SwiftUI
import PhotosUI

struct ScanRecipeView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.presentationMode) var presentationMode

    @State private var scanState: ScanState = .idle
    @State private var selectedImageData: Data?
    @State private var showingPicker = false
    @State private var showingCamera = false
    @State private var parsedRecipeId: String?
    @State private var navigateToRecipe = false

    private var palette: ThemePalette {
        appState.themeManager.palette
    }

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            switch scanState {
            case .idle:
                idleContent
            case .uploading:
                uploadingContent("Uploading image...")
            case .processing:
                uploadingContent("AI is reading your recipe...")
            case .success:
                successContent
            case .error(let message):
                errorContent(message)
            }

            Spacer()
        }
        .padding()
        .navigationBarTitle("Scan Recipe", displayMode: .inline)
        .sheet(isPresented: $showingPicker) {
            RecipeImagePicker { data in
                selectedImageData = data
                if data != nil {
                    Task { await uploadImage() }
                }
            }
        }
        .sheet(isPresented: $showingCamera) {
            CameraPickerView { data in
                selectedImageData = data
                if data != nil {
                    Task { await uploadImage() }
                }
            }
        }
        .background(
            Group {
                if let recipeId = parsedRecipeId {
                    NavigationLink(
                        destination: RecipeDetailView(recipeId: recipeId),
                        isActive: $navigateToRecipe
                    ) {
                        EmptyView()
                    }
                    .hidden()
                }
            }
        )
    }

    // MARK: - State Views

    private var idleContent: some View {
        VStack(spacing: 20) {
            Image(systemName: "camera.viewfinder")
                .font(.system(size: 64))
                .foregroundStyle(palette.primary)

            Text("Scan a Recipe")
                .font(Font.title2.bold())

            Text("Take a photo of a recipe or select from gallery.\nAI will extract ingredients, instructions, and details.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            VStack(spacing: 12) {
                Button(action: { showingCamera = true }) {
                    Label("Take Photo", systemImage: "camera")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(palette.primary)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                }

                Button(action: { showingPicker = true }) {
                    Label("Choose from Gallery", systemImage: "photo.on.rectangle")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color(.systemGray5))
                        .foregroundColor(palette.foreground)
                        .cornerRadius(12)
                }
            }
            .padding(.horizontal)
        }
    }

    private func uploadingContent(_ message: String) -> some View {
        VStack(spacing: 20) {
            if let data = selectedImageData, let uiImage = UIImage(data: data) {
                Image(uiImage: uiImage)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(height: 200)
                    .cornerRadius(12)
            }

            ProgressView()
                .scaleEffect(1.5)

            Text(message)
                .font(.headline)

            Text("This may take a moment")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var successContent: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 64))
                .foregroundColor(.green)

            Text("Recipe parsed successfully!")
                .font(.headline)
        }
        .onAppear {
            // Auto-navigate to the parsed recipe
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                if parsedRecipeId != nil {
                    navigateToRecipe = true
                } else {
                    presentationMode.wrappedValue.dismiss()
                }
            }
        }
    }

    private func errorContent(_ message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 64))
                .foregroundColor(.red.opacity(0.8))

            Text("Failed to process recipe")
                .font(.headline)

            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Button(action: { scanState = .idle }) {
                Text("Try Again")
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(palette.primary)
                    .foregroundColor(.white)
                    .cornerRadius(12)
            }
            .padding(.horizontal)
        }
    }

    // MARK: - Upload

    private func uploadImage() async {
        guard let imageData = selectedImageData else { return }

        await MainActor.run { scanState = .uploading }

        let filename = "recipe_\(Int(Date().timeIntervalSince1970)).jpg"

        await MainActor.run { scanState = .processing }

        let result = await appState.recipeRepository.uploadRecipeImage(
            imageData: imageData,
            filename: filename
        )

        await MainActor.run {
            switch result {
            case .success(let recipe):
                parsedRecipeId = recipe.id
                scanState = .success
            case .failure(let error):
                scanState = .error(error.localizedDescription)
            }
        }
    }
}

// MARK: - Scan State

private enum ScanState {
    case idle
    case uploading
    case processing
    case success
    case error(String)
}

// MARK: - Photo Picker (iOS 14+)

private struct RecipeImagePicker: UIViewControllerRepresentable {
    let onImageSelected: (Data?) -> Void

    func makeUIViewController(context: Context) -> PHPickerViewController {
        var config = PHPickerConfiguration()
        config.filter = .images
        config.selectionLimit = 1
        let picker = PHPickerViewController(configuration: config)
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: PHPickerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onImageSelected: onImageSelected)
    }

    class Coordinator: NSObject, PHPickerViewControllerDelegate {
        let onImageSelected: (Data?) -> Void

        init(onImageSelected: @escaping (Data?) -> Void) {
            self.onImageSelected = onImageSelected
        }

        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            picker.dismiss(animated: true)

            guard let provider = results.first?.itemProvider,
                  provider.canLoadObject(ofClass: UIImage.self) else {
                onImageSelected(nil)
                return
            }

            provider.loadObject(ofClass: UIImage.self) { [weak self] image, _ in
                guard let uiImage = image as? UIImage,
                      let data = uiImage.jpegData(compressionQuality: 0.85) else {
                    DispatchQueue.main.async { self?.onImageSelected(nil) }
                    return
                }
                DispatchQueue.main.async { self?.onImageSelected(data) }
            }
        }
    }
}

// MARK: - Camera Picker

private struct CameraPickerView: UIViewControllerRepresentable {
    let onImageCaptured: (Data?) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onImageCaptured: onImageCaptured)
    }

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onImageCaptured: (Data?) -> Void

        init(onImageCaptured: @escaping (Data?) -> Void) {
            self.onImageCaptured = onImageCaptured
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            picker.dismiss(animated: true)

            guard let uiImage = info[.originalImage] as? UIImage,
                  let data = uiImage.jpegData(compressionQuality: 0.85) else {
                onImageCaptured(nil)
                return
            }
            onImageCaptured(data)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            picker.dismiss(animated: true)
            onImageCaptured(nil)
        }
    }
}
