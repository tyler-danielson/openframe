package us.openframe.app.ui.navigation

import androidx.compose.runtime.*
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import us.openframe.app.data.local.DataStoreManager
import us.openframe.app.data.local.TokenManager
import us.openframe.app.ui.MainScreen
import us.openframe.app.ui.auth.AuthUiState
import us.openframe.app.ui.auth.AuthViewModel
import us.openframe.app.ui.auth.KioskPickerScreen
import us.openframe.app.ui.auth.LoginScreen
import us.openframe.app.ui.auth.ServerUrlScreen
import us.openframe.app.ui.auth.OAuthWebScreen
import us.openframe.app.ui.auth.SignupScreen
import us.openframe.app.ui.components.ErrorState
import us.openframe.app.ui.components.LoadingState
import us.openframe.app.ui.event.EventDetailScreen
import us.openframe.app.ui.event.NewEventScreen
import us.openframe.app.ui.kiosk.KioskControlScreen
import us.openframe.app.ui.photos.AlbumDetailScreen

@Composable
fun OpenFrameNavGraph(tokenManager: TokenManager, dataStoreManager: DataStoreManager) {
    val navController = rememberNavController()
    val isAuthenticated by tokenManager.isAuthenticated.collectAsState()

    // Observe auth state and navigate accordingly
    LaunchedEffect(isAuthenticated) {
        if (!isAuthenticated) {
            navController.navigate("auth") {
                popUpTo(0) { inclusive = true }
            }
        }
    }

    val startDestination = if (isAuthenticated) "main" else "auth"

    NavHost(navController = navController, startDestination = startDestination) {
        // Auth flow
        composable("auth") {
            val authViewModel: AuthViewModel = hiltViewModel()
            val uiState by authViewModel.uiState.collectAsState()
            val isSubmitting by authViewModel.isSubmitting.collectAsState()

            when (val state = uiState) {
                is AuthUiState.Loading -> LoadingState()
                is AuthUiState.ServerUrl -> ServerUrlScreen(
                    isSubmitting = isSubmitting,
                    onConnect = authViewModel::connectToServer,
                    onSignup = authViewModel::goToSignup,
                    onScanQr = { navController.navigate("qr-scan") },
                )
                is AuthUiState.Signup -> SignupScreen(
                    isSubmitting = isSubmitting,
                    onSignup = authViewModel::signup,
                    onGoToLogin = authViewModel::goToLogin,
                    onBack = authViewModel::goBackToServerUrl,
                )
                is AuthUiState.Login -> {
                    val googleClientId by authViewModel.googleClientId.collectAsState()
                    LoginScreen(
                        serverUrl = tokenManager.serverUrl,
                        isSubmitting = isSubmitting,
                        googleClientId = googleClientId,
                        onLogin = authViewModel::login,
                        onLoginApiKey = authViewModel::loginWithApiKey,
                        onGoogleIdToken = authViewModel::loginWithGoogleIdToken,
                        onOAuth = { provider -> navController.navigate("oauth/$provider") },
                        onScanQr = { navController.navigate("qr-scan") },
                        onBack = authViewModel::goBackToServerUrl,
                    )
                }
                is AuthUiState.KioskPicker -> KioskPickerScreen(
                    kiosks = state.kiosks,
                    isLoading = state.isLoadingKiosks,
                    userName = state.user?.name ?: state.user?.email?.substringBefore("@"),
                    onKioskSelected = { kiosk ->
                        authViewModel.onKioskSelected(kiosk)
                        navController.navigate("kiosk/${kiosk.id}") {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                    onSkip = {
                        authViewModel.skipKioskPicker()
                        navController.navigate("main") {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                )
                is AuthUiState.Authenticated -> {
                    LaunchedEffect(Unit) {
                        navController.navigate("main") {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                }
                is AuthUiState.Error -> ErrorState(
                    message = state.message,
                    onRetry = authViewModel::dismissError,
                )
            }
        }

        // Main app
        composable("main") {
            MainScreen(
                dataStoreManager = dataStoreManager,
                tokenManager = tokenManager,
                onNavigateToEvent = { id -> navController.navigate("event/$id") },
                onNavigateToNewEvent = { navController.navigate("event/new") },
                onNavigateToAlbum = { id -> navController.navigate("album/$id") },
                onNavigateToKiosk = { id -> navController.navigate("kiosk/$id") },
                onLogout = {
                    tokenManager.clearAll()
                    navController.navigate("auth") {
                        popUpTo(0) { inclusive = true }
                    }
                },
            )
        }

        // Detail screens
        composable("event/{eventId}") { backStack ->
            val eventId = backStack.arguments?.getString("eventId") ?: return@composable
            EventDetailScreen(
                eventId = eventId,
                onBack = { navController.popBackStack() },
                onDeleted = { navController.popBackStack() },
            )
        }

        composable("event/new") {
            NewEventScreen(
                onBack = { navController.popBackStack() },
                onCreated = { navController.popBackStack() },
            )
        }

        composable("album/{albumId}") { backStack ->
            val albumId = backStack.arguments?.getString("albumId") ?: return@composable
            AlbumDetailScreen(
                albumId = albumId,
                onBack = { navController.popBackStack() },
            )
        }

        composable("kiosk/{kioskId}") { backStack ->
            val kioskId = backStack.arguments?.getString("kioskId") ?: return@composable
            KioskControlScreen(
                kioskId = kioskId,
                onBack = { navController.popBackStack() },
            )
        }

        composable("oauth/{provider}") { backStack ->
            val provider = backStack.arguments?.getString("provider") ?: return@composable
            // Get the authViewModel from the parent "auth" route's backstack entry
            // We need a fresh instance here since we're in a different composable
            val authViewModel: AuthViewModel = hiltViewModel()
            val oauthUrl = authViewModel.getOAuthUrl(provider)

            OAuthWebScreen(
                oauthUrl = oauthUrl,
                onTokensReceived = { accessToken, refreshToken ->
                    authViewModel.handleOAuthTokens(accessToken, refreshToken)
                    navController.popBackStack("auth", inclusive = false)
                },
                onBack = { navController.popBackStack() },
            )
        }

        composable("qr-scan") {
            us.openframe.app.ui.auth.QrScanPlaceholder(
                onBack = { navController.popBackStack() },
            )
        }
    }
}
