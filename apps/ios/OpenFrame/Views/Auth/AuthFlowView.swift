import SwiftUI

struct AuthFlowView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel: AuthViewModel

    init(appState: AppState) {
        _viewModel = StateObject(wrappedValue: AuthViewModel(appState: appState))
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
        .onChange(of: appState.pendingDeepLinkTokens?.accessToken) { newValue in
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
