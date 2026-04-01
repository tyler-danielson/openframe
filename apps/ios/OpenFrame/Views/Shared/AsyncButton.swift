import SwiftUI

struct AsyncButton<Label: View>: View {
    let action: () async -> Void
    @ViewBuilder let label: () -> Label
    @State private var isLoading = false

    var body: some View {
        Button {
            guard !isLoading else { return }
            isLoading = true
            Task {
                await action()
                isLoading = false
            }
        } label: {
            if isLoading {
                ProgressView()
                    .tint(.white)
            } else {
                label()
            }
        }
        .disabled(isLoading)
    }
}
