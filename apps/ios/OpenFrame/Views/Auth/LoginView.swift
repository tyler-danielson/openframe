import SwiftUI
import UIKit
import AuthenticationServices

struct LoginView: View {
    @ObservedObject var viewModel: AuthViewModel
    @State private var email = ""
    @State private var password = ""
    @State private var apiKeyText = ""
    @State private var useApiKey = false
    @State private var showOAuth = false
    @State private var oauthProvider = ""

    private var palette: ThemePalette { viewModel.appState.themeManager.palette }

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    Text("Sign In")
                        .font(Font.title.bold())

                    // OAuth buttons
                    if let config = viewModel.authConfig {
                        if config.google?.clientId != nil {
                            OAuthButton(icon: "globe", title: "Continue with Google", color: .white.opacity(0.9)) {
                                oauthProvider = "google"
                                showOAuth = true
                            }
                        }
                        if config.microsoft?.available == true {
                            OAuthButton(icon: "building.2", title: "Continue with Microsoft", color: .blue.opacity(0.9)) {
                                oauthProvider = "microsoft"
                                showOAuth = true
                            }
                        }

                        if config.google != nil || config.microsoft?.available == true {
                            HStack {
                                Rectangle().frame(height: 1).foregroundStyle(palette.border)
                                Text("or").foregroundStyle(.secondary).font(.caption)
                                Rectangle().frame(height: 1).foregroundStyle(palette.border)
                            }
                        }
                    }

                    if !useApiKey {
                        // Email/password fields
                        VStack(spacing: 12) {
                            TextField("Email", text: $email)
                                .textFieldStyle(.roundedBorder)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .keyboardType(.emailAddress)

                            SecureField("Password", text: $password)
                                .textFieldStyle(.roundedBorder)

                            Button {
                                Task { await viewModel.login(email: email, password: password) }
                            } label: {
                                HStack {
                                    if viewModel.isLoading { ProgressView().tint(palette.primaryForeground) }
                                    Text("Sign In")
                                }
                                .frame(maxWidth: .infinity).padding()
                                .background(palette.primary)
                                .foregroundStyle(palette.primaryForeground)
                                .clipShape(RoundedRectangle(cornerRadius: 14))
                            }
                            .disabled(email.isEmpty || password.isEmpty || viewModel.isLoading)
                        }
                    } else {
                        // API Key field
                        VStack(spacing: 12) {
                            SecureField("API Key", text: $apiKeyText)
                                .textFieldStyle(.roundedBorder)

                            Button {
                                Task { await viewModel.loginWithApiKey(apiKeyText) }
                            } label: {
                                HStack {
                                    if viewModel.isLoading { ProgressView().tint(palette.primaryForeground) }
                                    Text("Connect with API Key")
                                }
                                .frame(maxWidth: .infinity).padding()
                                .background(palette.primary)
                                .foregroundStyle(palette.primaryForeground)
                                .clipShape(RoundedRectangle(cornerRadius: 14))
                            }
                            .disabled(apiKeyText.isEmpty || viewModel.isLoading)
                        }
                    }

                    // Toggle API key mode
                    Button {
                        useApiKey.toggle()
                    } label: {
                        HStack {
                            Image(systemName: useApiKey ? "envelope" : "key")
                            Text(useApiKey ? "Use Email & Password" : "Use API Key")
                        }
                        .font(.subheadline)
                    }

                    if let error = viewModel.errorMessage {
                        Text(error).foregroundStyle(.red).font(.caption)
                    }

                    Spacer().frame(height: 8)

                    Button("Back to Server Selection") {
                        viewModel.goToServerUrl()
                    }
                    .font(.subheadline).foregroundStyle(.secondary)
                }
                .padding(.horizontal, 24)
                .padding(.top, 40)
            }
        }
        .navigationViewStyle(.stack)
        .sheet(isPresented: $showOAuth) {
            OAuthWebView(
                provider: oauthProvider,
                serverUrl: viewModel.keychainManager.serverUrl ?? "",
                onComplete: { accessToken, refreshToken in
                    showOAuth = false
                    Task {
                        await viewModel.handleOAuthTokens(
                            accessToken: accessToken,
                            refreshToken: refreshToken
                        )
                    }
                },
                onCancel: { showOAuth = false }
            )
        }
    }
}

private struct OAuthButton: View {
    let icon: String
    let title: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: icon)
                Text(title)
            }
            .frame(maxWidth: .infinity).padding()
            .background(color.opacity(0.15))
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
    }
}

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
        print("[OAuth] Opening URL: \(components?.url?.absoluteString ?? "nil") (serverUrl=\(serverUrl))")
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
        guard authSession == nil, let url = oauthURL, let coordinator = coordinator else { return }

        let session = ASWebAuthenticationSession(
            url: url,
            callbackURLScheme: "openframe"
        ) { [weak self] callbackURL, error in
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
        authSession = session // Retain the session
        session.start()
    }
}
