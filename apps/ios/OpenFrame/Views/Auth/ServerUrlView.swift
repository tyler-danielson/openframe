import SwiftUI

struct ServerUrlView: View {
    @ObservedObject var viewModel: AuthViewModel
    @State private var customUrl = ""
    @State private var showCustomUrl = false

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    Spacer().frame(height: 40)

                    // Logo
                    Image(systemName: "square.grid.2x2.fill")
                        .font(.system(size: 60))
                        .foregroundStyle(viewModel.appState.themeManager.palette.primary)
                        .frame(width: 80, height: 80)

                    Text("OpenFrame")
                        .font(Font.largeTitle.bold())

                    Text("Your life, beautifully organized")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    // Feature chips
                    HStack(spacing: 8) {
                        FeatureChip(icon: "calendar", text: "Calendar")
                        FeatureChip(icon: "tv", text: "Kiosks")
                        FeatureChip(icon: "checklist", text: "Tasks")
                    }

                    Spacer().frame(height: 16)

                    // Connect button
                    Button {
                        Task { await viewModel.connectToOpenFrame() }
                    } label: {
                        HStack {
                            if viewModel.isLoading && !showCustomUrl {
                                ProgressView().tint(.white)
                            }
                            Text("Connect to OpenFrame.us")
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(viewModel.appState.themeManager.palette.primary)
                        .foregroundStyle(viewModel.appState.themeManager.palette.primaryForeground)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .disabled(viewModel.isLoading)

                    // Signup link
                    Button {
                        viewModel.keychainManager.serverUrl = "https://openframe.us"
                        viewModel.goToSignup()
                    } label: {
                        Text("Create a Free Account")
                            .frame(maxWidth: .infinity)
                            .padding()
                            .overlay(
                                RoundedRectangle(cornerRadius: 14)
                                    .stroke(viewModel.appState.themeManager.palette.border, lineWidth: 1)
                            )
                    }

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
                        .foregroundStyle(.secondary)
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
                                Task { await viewModel.connectToServer(customUrl) }
                            } label: {
                                HStack {
                                    if viewModel.isLoading {
                                        ProgressView().tint(.white)
                                    }
                                    Text("Connect")
                                }
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(viewModel.appState.themeManager.palette.primary)
                                .foregroundStyle(viewModel.appState.themeManager.palette.primaryForeground)
                                .clipShape(RoundedRectangle(cornerRadius: 14))
                            }
                            .disabled(customUrl.isEmpty || viewModel.isLoading)
                        }
                    }

                    if let error = viewModel.errorMessage {
                        Text(error)
                            .foregroundStyle(.red)
                            .font(.caption)
                    }
                }
                .padding(.horizontal, 24)
            }
        }
    }

    private var appState: AppState {
        viewModel.appState
    }
}

private struct FeatureChip: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption2)
            Text(text)
                .font(.caption)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(.secondary.opacity(0.15))
        .clipShape(Capsule())
    }
}
