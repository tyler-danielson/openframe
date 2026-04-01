import SwiftUI

struct SignupView: View {
    @EnvironmentObject var container: DIContainer
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        let palette = container.themeManager.palette
        ScrollView {
            VStack(spacing: 20) {
                Text("Create Account")
                    .font(.title.bold())
                    .foregroundStyle(palette.foreground)

                VStack(spacing: 12) {
                    TextField("Name", text: $name)
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.words)

                    TextField("Email", text: $email)
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.emailAddress)

                    SecureField("Password (8+ characters)", text: $password)
                        .textFieldStyle(.roundedBorder)

                    Button {
                        signup()
                    } label: {
                        HStack {
                            if isLoading { ProgressView().tint(palette.primaryForeground) }
                            Text("Create Account")
                        }
                        .frame(maxWidth: .infinity).padding()
                        .background(palette.primary)
                        .foregroundStyle(palette.primaryForeground)
                        .cornerRadius(14)
                    }
                    .disabled(name.isEmpty || email.isEmpty || password.count < 8 || isLoading)
                }

                if let error {
                    Text(error)
                        .foregroundStyle(palette.destructive)
                        .font(.caption)
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 40)
        }
        .background(palette.background.ignoresSafeArea())
    }

    private func signup() {
        isLoading = true
        error = nil
        Task {
            do {
                let user = try await container.authRepository.signup(name: name, email: email, password: password)
                await container.handleLogin(user: user)
            } catch {
                self.error = error.localizedDescription
            }
            isLoading = false
        }
    }
}
