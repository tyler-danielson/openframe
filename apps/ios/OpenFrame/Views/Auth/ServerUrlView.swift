import SwiftUI

struct ServerUrlView: View {
    @EnvironmentObject var container: DIContainer
    @State private var customUrl = ""
    @State private var showCustomUrl = false
    @State private var isConnecting = false
    @State private var error: String?

    var body: some View {
        let palette = container.themeManager.palette
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    Spacer().frame(height: 40)

                    Image(systemName: "square.grid.2x2.fill")
                        .font(.system(size: 60))
                        .foregroundStyle(palette.primary)

                    Text("OpenFrame")
                        .font(.largeTitle.bold())
                        .foregroundStyle(palette.foreground)

                    Text("Your life, beautifully organized")
                        .font(.subheadline)
                        .foregroundStyle(palette.mutedForeground)

                    HStack(spacing: 8) {
                        FeatureChip(icon: "calendar", text: "Calendar", palette: palette)
                        FeatureChip(icon: "tv", text: "Kiosks", palette: palette)
                        FeatureChip(icon: "checklist", text: "Tasks", palette: palette)
                    }

                    Spacer().frame(height: 16)

                    // Connect to OpenFrame.us
                    Button {
                        connectToServer("https://openframe.us")
                    } label: {
                        HStack {
                            if isConnecting && !showCustomUrl {
                                ProgressView().tint(palette.primaryForeground)
                            }
                            Text("Connect to OpenFrame.us")
                        }
                        .frame(maxWidth: .infinity).padding()
                        .background(palette.primary)
                        .foregroundStyle(palette.primaryForeground)
                        .cornerRadius(14)
                    }
                    .disabled(isConnecting)

                    // Self-hosted toggle
                    Button {
                        withAnimation { showCustomUrl.toggle() }
                    } label: {
                        HStack {
                            Image(systemName: "server.rack")
                            Text("Self-hosted server")
                            Spacer()
                            Image(systemName: showCustomUrl ? "chevron.up" : "chevron.down")
                        }
                        .foregroundStyle(palette.mutedForeground)
                        .font(.subheadline)
                    }

                    if showCustomUrl {
                        VStack(spacing: 12) {
                            TextField("https://your-server.com", text: $customUrl)
                                .textFieldStyle(.roundedBorder)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .keyboardType(.URL)

                            Button {
                                connectToServer(customUrl)
                            } label: {
                                HStack {
                                    if isConnecting {
                                        ProgressView().tint(palette.primaryForeground)
                                    }
                                    Text("Connect")
                                }
                                .frame(maxWidth: .infinity).padding()
                                .background(palette.primary)
                                .foregroundStyle(palette.primaryForeground)
                                .cornerRadius(14)
                            }
                            .disabled(customUrl.isEmpty || isConnecting)
                        }
                    }

                    if let error {
                        Text(error)
                            .foregroundStyle(palette.destructive)
                            .font(.caption)
                    }
                }
                .padding(.horizontal, 24)
            }
            .background(palette.background.ignoresSafeArea())
        }
        .navigationViewStyle(.stack)
    }

    private func connectToServer(_ url: String) {
        isConnecting = true
        error = nil
        let cleanUrl = url.trimmingCharacters(in: .whitespacesAndNewlines)
        let fullUrl = cleanUrl.hasPrefix("http") ? cleanUrl : "https://\(cleanUrl)"

        Task {
            let ok = await container.authRepository.checkServerHealth(serverUrl: fullUrl)
            if ok {
                container.keychainService.serverUrl = fullUrl
                await container.loadAuthConfig()
            } else {
                error = "Could not connect to server"
            }
            isConnecting = false
        }
    }
}

private struct FeatureChip: View {
    let icon: String
    let text: String
    let palette: ThemePalette

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon).font(.caption2)
            Text(text).font(.caption)
        }
        .padding(.horizontal, 10).padding(.vertical, 6)
        .background(palette.secondary)
        .cornerRadius(20)
        .foregroundStyle(palette.mutedForeground)
    }
}
