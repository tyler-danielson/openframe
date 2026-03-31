package us.openframe.app.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import us.openframe.app.data.local.TokenManager
import us.openframe.app.data.repository.AuthRepository
import us.openframe.app.data.repository.KioskRepository
import us.openframe.app.domain.model.Kiosk
import us.openframe.app.domain.model.User
import javax.inject.Inject

sealed interface AuthUiState {
    data object Loading : AuthUiState
    data object ServerUrl : AuthUiState
    data object Signup : AuthUiState
    data object Login : AuthUiState
    data class KioskPicker(
        val user: User?,
        val kiosks: List<Kiosk>?,
        val isLoadingKiosks: Boolean,
    ) : AuthUiState
    data class Authenticated(val user: User?) : AuthUiState
    data class Error(val message: String) : AuthUiState
}

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val kioskRepository: KioskRepository,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Loading)
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    /** Google web client ID fetched from the server, for Credential Manager */
    private val _googleClientId = MutableStateFlow<String?>(null)
    val googleClientId: StateFlow<String?> = _googleClientId.asStateFlow()

    private val _isSubmitting = MutableStateFlow(false)
    val isSubmitting: StateFlow<Boolean> = _isSubmitting.asStateFlow()

    init {
        checkExistingAuth()
        observeDeepLinkTokens()
    }

    /** Watch for OAuth tokens arriving via deep link (Chrome Custom Tabs redirect) */
    private fun observeDeepLinkTokens() {
        viewModelScope.launch {
            us.openframe.app.DeepLinkState.pendingTokens.collect { tokens ->
                if (tokens != null) {
                    us.openframe.app.DeepLinkState.consumeTokens()
                    handleOAuthTokens(tokens.accessToken, tokens.refreshToken)
                }
            }
        }
    }

    private fun checkExistingAuth() {
        when {
            !tokenManager.hasServerUrl() -> _uiState.value = AuthUiState.ServerUrl
            !tokenManager.hasCredentials() -> {
                fetchGoogleClientId()
                _uiState.value = AuthUiState.Login
            }
            else -> {
                // Validate existing credentials — skip kiosk picker on returning users
                viewModelScope.launch {
                    val result = authRepository.getCurrentUser()
                    _uiState.value = result.fold(
                        onSuccess = { AuthUiState.Authenticated(it) },
                        onFailure = { AuthUiState.Login },
                    )
                }
            }
        }
    }

    fun connectToServer(url: String) {
        viewModelScope.launch {
            _isSubmitting.value = true
            val normalizedUrl = url.trimEnd('/').let {
                if (!it.startsWith("http")) "https://$it" else it
            }

            val healthy = authRepository.checkServerHealth(normalizedUrl)
            _isSubmitting.value = false

            if (healthy) {
                tokenManager.serverUrl = normalizedUrl
                fetchGoogleClientId()
                _uiState.value = AuthUiState.Login
            } else {
                _uiState.value = AuthUiState.Error("Could not connect to server")
            }
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _isSubmitting.value = true
            val result = authRepository.login(email, password)
            _isSubmitting.value = false

            result.fold(
                onSuccess = { user -> transitionToKioskPicker(user) },
                onFailure = { _uiState.value = AuthUiState.Error(it.message ?: "Login failed") },
            )
        }
    }

    fun loginWithApiKey(apiKey: String) {
        viewModelScope.launch {
            _isSubmitting.value = true
            val result = authRepository.loginWithApiKey(apiKey)
            _isSubmitting.value = false

            result.fold(
                onSuccess = { user -> transitionToKioskPicker(user) },
                onFailure = { _uiState.value = AuthUiState.Error(it.message ?: "Invalid API key") },
            )
        }
    }

    /**
     * After login, show the kiosk picker screen with a loading state
     * while we fetch the user's kiosks.
     */
    private fun transitionToKioskPicker(user: User) {
        _uiState.value = AuthUiState.KioskPicker(
            user = user,
            kiosks = null,
            isLoadingKiosks = true,
        )

        viewModelScope.launch {
            val result = kioskRepository.getKiosks()
            val currentState = _uiState.value
            if (currentState is AuthUiState.KioskPicker) {
                _uiState.value = currentState.copy(
                    kiosks = result.getOrElse { emptyList() },
                    isLoadingKiosks = false,
                )
            }
        }
    }

    fun goToSignup() {
        // Pre-set server to openframe.us for cloud sign-ups
        if (!tokenManager.hasServerUrl()) {
            tokenManager.serverUrl = "https://openframe.us"
        }
        _uiState.value = AuthUiState.Signup
    }

    fun goToLogin() {
        _uiState.value = AuthUiState.Login
    }

    fun signup(name: String, email: String, password: String) {
        viewModelScope.launch {
            _isSubmitting.value = true
            val result = authRepository.signup(name, email, password)
            _isSubmitting.value = false

            result.fold(
                onSuccess = { user -> transitionToKioskPicker(user) },
                onFailure = { _uiState.value = AuthUiState.Error(it.message ?: "Sign up failed") },
            )
        }
    }

    private fun fetchGoogleClientId() {
        viewModelScope.launch {
            _googleClientId.value = authRepository.getGoogleClientId()
        }
    }

    fun loginWithGoogleIdToken(idToken: String) {
        viewModelScope.launch {
            _isSubmitting.value = true
            val result = authRepository.loginWithGoogleIdToken(idToken)
            _isSubmitting.value = false

            result.fold(
                onSuccess = { user -> transitionToKioskPicker(user) },
                onFailure = { _uiState.value = AuthUiState.Error(it.message ?: "Google sign-in failed") },
            )
        }
    }

    fun getOAuthUrl(provider: String): String {
        val serverUrl = tokenManager.serverUrl ?: "https://openframe.us"
        val callbackUrl = "$serverUrl/auth/callback"
        return "$serverUrl/api/v1/auth/oauth/$provider?callbackUrl=${java.net.URLEncoder.encode(callbackUrl, "UTF-8")}"
    }

    fun handleOAuthTokens(accessToken: String, refreshToken: String) {
        tokenManager.saveTokens(accessToken, refreshToken)
        // Fetch user info then show kiosk picker
        viewModelScope.launch {
            val result = authRepository.getCurrentUser()
            val user = result.getOrNull()
            transitionToKioskPicker(user ?: User("", "", null, null, null, null))
        }
    }

    fun onKioskSelected(kiosk: Kiosk) {
        val currentState = _uiState.value
        val user = if (currentState is AuthUiState.KioskPicker) currentState.user else null
        _uiState.value = AuthUiState.Authenticated(user)
    }

    fun skipKioskPicker() {
        val currentState = _uiState.value
        val user = if (currentState is AuthUiState.KioskPicker) currentState.user else null
        _uiState.value = AuthUiState.Authenticated(user)
    }

    fun handleQrResult(data: String) {
        // Parse openframe://connect?server=URL&apiKey=KEY
        if (data.startsWith("openframe://connect")) {
            val params = data.substringAfter("?").split("&").associate {
                val (key, value) = it.split("=", limit = 2)
                key to java.net.URLDecoder.decode(value, "UTF-8")
            }
            val server = params["server"]
            val apiKey = params["apiKey"]

            if (server != null) {
                tokenManager.serverUrl = server.trimEnd('/')
                if (apiKey != null) {
                    loginWithApiKey(apiKey)
                } else {
                    _uiState.value = AuthUiState.Login
                }
            }
        } else if (data.startsWith("http")) {
            // Treat as server URL
            connectToServer(data)
        }
    }

    fun dismissError() {
        _uiState.value = if (tokenManager.hasServerUrl()) AuthUiState.Login else AuthUiState.ServerUrl
    }

    fun goBackToServerUrl() {
        tokenManager.serverUrl = null
        _uiState.value = AuthUiState.ServerUrl
    }
}
