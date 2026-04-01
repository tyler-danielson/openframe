import SwiftUI

struct LoadingView: View {
    var message: String = "Loading..."
    @EnvironmentObject var container: DIContainer

    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .tint(container.themeManager.palette.primary)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(container.themeManager.palette.mutedForeground)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(container.themeManager.palette.background)
    }
}

struct ErrorView: View {
    let message: String
    var retryAction: (() -> Void)?
    @EnvironmentObject var container: DIContainer

    var body: some View {
        let palette = container.themeManager.palette
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 40))
                .foregroundStyle(palette.destructive)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(palette.mutedForeground)
                .multilineTextAlignment(.center)
            if let retryAction {
                Button("Try Again", action: retryAction)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(palette.primary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct EmptyStateView: View {
    let icon: String
    let title: String
    var message: String?
    var actionTitle: String?
    var action: (() -> Void)?
    @EnvironmentObject var container: DIContainer

    var body: some View {
        let palette = container.themeManager.palette
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundStyle(palette.primary.opacity(0.5))
            Text(title)
                .font(.headline)
                .foregroundStyle(palette.foreground)
            if let message {
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(palette.mutedForeground)
                    .multilineTextAlignment(.center)
            }
            if let actionTitle, let action {
                Button(action: action) {
                    Text(actionTitle)
                        .font(.subheadline.weight(.medium))
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(palette.primary)
                        .foregroundStyle(palette.primaryForeground)
                        .cornerRadius(10)
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
