import SwiftUI
import AuthenticationServices

struct LoginView: View {
    @EnvironmentObject var container: DIContainer
    @State private var email = ""
    @State private var password = ""
    @State private var apiKeyText = ""
    @State private var useApiKey = false
    @State private var showOAuth = false
    @State private var oauthProvider = ""
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        let palette = container.themeManager.palette
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    Text("Sign In")
                        .font(.title.bold())
                        .foregroundStyle(palette.foreground)

                    if let url = container.keychainService.serverUrl {
                        Text(url)
                            .font(.caption)
                            .foregroundStyle(palette.mutedForeground)
                    }

                    // OAuth buttons
                    if let config = container.authConfig {
                        if config.google?.clientId != nil {
                            OAuthButton(icon: "globe", title: "Continue with Google", palette: palette) {
                                oauthProvider = "google"
                                showOAuth = true
                            }
                        }
                        if config.microsoft?.available == true {
                            OAuthButton(icon: "building.2", title: "Continue with Microsoft", palette: palette) {
                                oauthProvider = "microsoft"
                                showOAuth = true
                            }
                        }

                        if config.google?.clientId != nil || config.microsoft?.available == true {
                            HStack {
                                Rectangle().frame(height: 1).foregroundStyle(palette.border)
                                Text("or").foregroundStyle(palette.mutedForeground).font(.caption)
                                Rectangle().frame(height: 1).foregroundStyle(palette.border)
                            }
                        }
                    }

                    if !useApiKey {
                        VStack(spacing: 12) {
                            TextField("Email", text: $email)
                                .textFieldStyle(.roundedBorder)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .keyboardType(.emailAddress)

                            SecureField("Password", text: $password)
                                .textFieldStyle(.roundedBorder)

                            Button {
                                loginWithEmail()
                            } label: {
                                HStack {
                                    if isLoading { ProgressView().tint(palette.primaryForeground) }
                                    Text("Sign In")
                                }
                                .frame(maxWidth: .infinity).padding()
                                .background(palette.primary)
                                .foregroundStyle(palette.primaryForeground)
                                .cornerRadius(14)
                            }
                            .disabled(email.isEmpty || password.isEmpty || isLoading)
                        }
                    } else {
                        VStack(spacing: 12) {
                            SecureField("API Key", text: $apiKeyText)
                                .textFieldStyle(.roundedBorder)

                            Button {
                                loginWithApiKey()
                            } label: {
                                HStack {
                                    if isLoading { ProgressView().tint(palette.primaryForeground) }
                                    Text("Connect with API Key")
                                }
                                .frame(maxWidth: .infinity).padding()
                                .background(palette.primary)
                                .foregroundStyle(palette.primaryForeground)
                                .cornerRadius(14)
                            }
                            .disabled(apiKeyText.isEmpty || isLoading)
                        }
                    }

                    Button {
                        useApiKey.toggle()
                    } label: {
                        HStack {
                            Image(systemName: useApiKey ? "envelope" : "key")
                            Text(useApiKey ? "Use Email & Password" : "Use API Key")
                        }
                        .font(.subheadline)
                        .foregroundStyle(palette.primary)
                    }

                    if let error {
                        Text(error)
                            .foregroundStyle(palette.destructive)
                            .font(.caption)
                    }

                    Spacer().frame(height: 8)

                    Button("Back to Server Selection") {
                        container.keychainService.serverUrl = nil
                        container.authConfig = nil
                    }
                    .font(.subheadline)
                    .foregroundStyle(palette.mutedForeground)
                }
                .padding(.horizontal, 24)
                .padding(.top, 40)
            }
            .background(palette.background.ignoresSafeArea())
        }
        .navigationViewStyle(.stack)
        .sheet(isPresented: $showOAuth) {
            OAuthWebView(
                provider: oauthProvider,
                serverUrl: container.keychainService.serverUrl ?? "",
                onComplete: { accessToken, refreshToken in
                    showOAuth = false
                    container.authRepository.saveOAuthTokens(accessToken: accessToken, refreshToken: refreshToken)
                    Task { await container.checkInitialAuth() }
                },
                onCancel: { showOAuth = false }
            )
        }
    }

    private func loginWithEmail() {
        isLoading = true
        error = nil
        Task {
            do {
                let user = try await container.authRepository.login(email: email, password: password)
                await container.handleLogin(user: user)
            } catch {
                self.error = error.localizedDescription
            }
            isLoading = false
        }
    }

    private func loginWithApiKey() {
        isLoading = true
        error = nil
        Task {
            do {
                let user = try await container.authRepository.loginWithApiKey(apiKeyText)
                await container.handleLogin(user: user)
            } catch {
                self.error = error.localizedDescription
            }
            isLoading = false
        }
    }
}

private struct OAuthButton: View {
    let icon: String
    let title: String
    let palette: ThemePalette
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: icon)
                Text(title)
            }
            .frame(maxWidth: .infinity).padding()
            .background(palette.secondary)
            .foregroundStyle(palette.foreground)
            .cornerRadius(14)
        }
    }
}

// MARK: - OAuth WebView

struct OAuthWebView: UIViewControllerRepresentable {
    let provider: String
    let serverUrl: String
    let onComplete: (String, String) -> Void
    let onCancel: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onComplete: onComplete, onCancel: onCancel)
    }

    func makeUIViewController(context: Context) -> OAuthHostController {
        let vc = OAuthHostController()
        vc.coordinator = context.coordinator
        var components = URLComponents(string: "\(serverUrl)/api/v1/auth/oauth/\(provider)")
        components?.queryItems = [
            URLQueryItem(name: "callbackUrl", value: "openframe://auth/callback"),
            URLQueryItem(name: "mobile", value: "true"),
        ]
        vc.oauthURL = components?.url
        return vc
    }

    func updateUIViewController(_ uiViewController: OAuthHostController, context: Context) {}

    final class Coordinator: NSObject, ASWebAuthenticationPresentationContextProviding {
        let onComplete: (String, String) -> Void
        let onCancel: () -> Void

        init(onComplete: @escaping (String, String) -> Void, onCancel: @escaping () -> Void) {
            self.onComplete = onComplete
            self.onCancel = onCancel
        }

        func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
            UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
                .first(where: { $0.isKeyWindow }) ?? ASPresentationAnchor()
        }
    }
}

final class OAuthHostController: UIViewController {
    var coordinator: OAuthWebView.Coordinator?
    var oauthURL: URL?
    private var authSession: ASWebAuthenticationSession?

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard authSession == nil, let url = oauthURL, let coordinator else { return }

        let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "openframe") { [weak self] callbackURL, error in
            guard let callbackURL, error == nil,
                  let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
                  let items = components.queryItems,
                  let accessToken = items.first(where: { $0.name == "accessToken" })?.value,
                  let refreshToken = items.first(where: { $0.name == "refreshToken" })?.value else {
                self?.coordinator?.onCancel()
                return
            }
            self?.coordinator?.onComplete(accessToken, refreshToken)
        }
        session.presentationContextProvider = coordinator
        session.prefersEphemeralWebBrowserSession = false
        authSession = session
        session.start()
    }
}
