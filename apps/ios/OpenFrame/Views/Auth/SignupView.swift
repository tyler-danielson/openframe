import SwiftUI

struct SignupView: View {
    @ObservedObject var viewModel: AuthViewModel
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""

    private var palette: ThemePalette { viewModel.appState.themeManager.palette }

    private var passwordError: String? {
        if !confirmPassword.isEmpty && password != confirmPassword {
            return "Passwords don't match"
        }
        if !password.isEmpty && password.count < 8 {
            return "Password must be at least 8 characters"
        }
        return nil
    }

    private var canSubmit: Bool {
        !name.isEmpty && !email.isEmpty && password.count >= 8 && password == confirmPassword && !viewModel.isLoading
    }

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    Text("Create Account")
                        .font(.title).bold()

                    VStack(spacing: 12) {
                        TextField("Full Name", text: $name)
                            .textFieldStyle(.roundedBorder)
                            .textContentType(.name)

                        TextField("Email", text: $email)
                            .textFieldStyle(.roundedBorder)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.emailAddress)
                            .textContentType(.emailAddress)

                        SecureField("Password (8+ characters)", text: $password)
                            .textFieldStyle(.roundedBorder)
                            .textContentType(.newPassword)

                        SecureField("Confirm Password", text: $confirmPassword)
                            .textFieldStyle(.roundedBorder)
                            .textContentType(.newPassword)

                        if let error = passwordError {
                            Text(error)
                                .foregroundStyle(.red)
                                .font(.caption)
                        }
                    }

                    Button {
                        Task { await viewModel.signup(name: name, email: email, password: password) }
                    } label: {
                        HStack {
                            if viewModel.isLoading { ProgressView().tint(palette.primaryForeground) }
                            Text("Create Account")
                        }
                        .frame(maxWidth: .infinity).padding()
                        .background(palette.primary)
                        .foregroundStyle(palette.primaryForeground)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .disabled(!canSubmit)

                    if let error = viewModel.errorMessage {
                        Text(error).foregroundStyle(.red).font(.caption)
                    }

                    Button("Already have an account? Sign In") {
                        viewModel.goToLogin()
                    }
                    .font(.subheadline)
                }
                .padding(.horizontal, 24)
                .padding(.top, 40)
            }
        }
    }
}
