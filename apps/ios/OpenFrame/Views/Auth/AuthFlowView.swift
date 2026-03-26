import SwiftUI

struct AuthFlowView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel: AuthViewModel

    init(appState: AppState) {
        _viewModel = State(initialValue: AuthViewModel(appState: appState))
    }

    var body: some View {
        Group {
            switch viewModel.screen {
            case .loading:
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .serverUrl:
                ServerUrlView(viewModel: viewModel)
            case .login:
                LoginView(viewModel: viewModel)
            case .signup:
                SignupView(viewModel: viewModel)
            case .kioskPicker(let user):
                KioskPickerView(viewModel: viewModel, user: user)
            case .authenticated:
                EmptyView() // Handled by ContentView
            }
        }
        .task {
            await viewModel.checkInitialState()
        }
        .onChange(of: appState.pendingDeepLinkTokens?.accessToken) { _, newValue in
            if let tokens = appState.pendingDeepLinkTokens {
                Task {
                    await viewModel.handleOAuthTokens(
                        accessToken: tokens.accessToken,
                        refreshToken: tokens.refreshToken
                    )
                    appState.pendingDeepLinkTokens = nil
                }
            }
        }
    }
}
