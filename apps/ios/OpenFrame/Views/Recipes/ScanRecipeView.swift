import SwiftUI
import AVFoundation

struct ScanRecipeView: View {
    @EnvironmentObject var container: DIContainer
    @Environment(\.presentationMode) var presentationMode
    @State private var showPicker = false
    @State private var isScanning = false
    @State private var error: String?

    var body: some View {
        let palette = container.themeManager.palette
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "camera.viewfinder")
                .font(.system(size: 60))
                .foregroundStyle(palette.primary)

            Text("Scan a Recipe")
                .font(.title2.bold())
                .foregroundStyle(palette.foreground)

            Text("Take a photo of a recipe from a book, card, or screen and we'll parse it automatically.")
                .font(.subheadline)
                .foregroundStyle(palette.mutedForeground)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            if isScanning {
                ProgressView("Scanning...")
                    .tint(palette.primary)
            } else {
                Button {
                    showPicker = true
                } label: {
                    Text("Choose Photo")
                        .frame(maxWidth: .infinity).padding()
                        .background(palette.primary)
                        .foregroundStyle(palette.primaryForeground)
                        .cornerRadius(14)
                }
                .padding(.horizontal, 24)
            }

            if let error {
                Text(error)
                    .foregroundStyle(palette.destructive)
                    .font(.caption)
            }

            Spacer()
        }
        .background(palette.background.ignoresSafeArea())
        .navigationTitle("Scan Recipe")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showPicker) {
            PhotoPickerView { _ in
                // TODO: Upload image for scanning
                isScanning = false
            }
        }
    }
}
