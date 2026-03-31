package us.openframe.app

import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import us.openframe.app.data.local.DataStoreManager
import us.openframe.app.data.local.TokenManager
import us.openframe.app.ui.navigation.OpenFrameNavGraph
import us.openframe.app.ui.theme.OpenFrameColorScheme
import us.openframe.app.ui.theme.OpenFrameTheme
import javax.inject.Inject

/**
 * Holds pending OAuth tokens received via deep link (openframe://auth/callback).
 * Consumed by AuthViewModel when it observes the flow.
 */
data class OAuthDeepLinkTokens(val accessToken: String, val refreshToken: String)

object DeepLinkState {
    private val _pendingTokens = MutableStateFlow<OAuthDeepLinkTokens?>(null)
    val pendingTokens: StateFlow<OAuthDeepLinkTokens?> = _pendingTokens.asStateFlow()

    fun setPendingTokens(tokens: OAuthDeepLinkTokens) {
        _pendingTokens.value = tokens
    }

    fun consumeTokens(): OAuthDeepLinkTokens? {
        val tokens = _pendingTokens.value
        _pendingTokens.value = null
        return tokens
    }
}

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var tokenManager: TokenManager

    @Inject
    lateinit var dataStoreManager: DataStoreManager

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Handle deep link from initial launch
        handleDeepLink(intent)

        setContent {
            val colorSchemeKey by dataStoreManager.colorScheme.collectAsState(initial = "default")
            val scheme = OpenFrameColorScheme.fromKey(colorSchemeKey)

            OpenFrameTheme(colorScheme = scheme) {
                OpenFrameNavGraph(tokenManager = tokenManager, dataStoreManager = dataStoreManager)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        val uri = intent?.data ?: return
        Log.d("MainActivity", "Deep link received: $uri")

        // Handle openframe://auth/callback?accessToken=...&refreshToken=...
        if (uri.scheme == "openframe" && uri.host == "auth" && uri.path == "/callback") {
            val accessToken = uri.getQueryParameter("accessToken")
            val refreshToken = uri.getQueryParameter("refreshToken")
            if (accessToken != null && refreshToken != null) {
                Log.d("MainActivity", "OAuth tokens received via deep link")
                DeepLinkState.setPendingTokens(OAuthDeepLinkTokens(accessToken, refreshToken))
            }
        }

        // Handle openframe://connect?server=...&apiKey=...
        // (handled by AuthViewModel via QR scan flow — already supported)
    }
}
