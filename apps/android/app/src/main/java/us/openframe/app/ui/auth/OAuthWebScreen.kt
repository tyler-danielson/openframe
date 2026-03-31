package us.openframe.app.ui.auth

import android.graphics.Bitmap
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView

/**
 * In-app WebView that handles the OAuth redirect flow.
 *
 * Flow:
 * 1. Loads the OAuth initiation URL (e.g. /api/v1/auth/oauth/google)
 * 2. User authenticates with Google/Microsoft in the WebView
 * 3. Server redirects back to our callbackUrl with tokens in query params
 * 4. We intercept the redirect and extract accessToken + refreshToken
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OAuthWebScreen(
    oauthUrl: String,
    onTokensReceived: (accessToken: String, refreshToken: String) -> Unit,
    onBack: () -> Unit,
) {
    var isLoading by remember { mutableStateOf(true) }
    var pageTitle by remember { mutableStateOf("Sign In") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(pageTitle, maxLines = 1) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Cancel")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        Box(modifier = Modifier.padding(padding)) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { context ->
                    WebView(context).apply {
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.userAgentString = "OpenFrame-Android/1.0"

                        webViewClient = object : WebViewClient() {
                            override fun shouldOverrideUrlLoading(
                                view: WebView?,
                                request: WebResourceRequest?,
                            ): Boolean {
                                val url = request?.url ?: return false
                                return handleUrl(url, onTokensReceived)
                            }

                            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                isLoading = true
                                // Check if the page URL itself contains tokens
                                // (in case shouldOverrideUrlLoading didn't fire)
                                if (url != null) {
                                    val uri = Uri.parse(url)
                                    handleUrl(uri, onTokensReceived)
                                }
                            }

                            override fun onPageFinished(view: WebView?, url: String?) {
                                isLoading = false
                                pageTitle = view?.title ?: "Sign In"
                            }
                        }

                        loadUrl(oauthUrl)
                    }
                },
            )

            if (isLoading) {
                LinearProgressIndicator(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.TopCenter),
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}

/**
 * Intercept the OAuth callback URL and extract tokens.
 * Returns true if this was a callback URL we handled.
 */
private fun handleUrl(
    uri: Uri,
    onTokensReceived: (String, String) -> Unit,
): Boolean {
    // Check for our callback pattern: /auth/callback?accessToken=...&refreshToken=...
    val path = uri.path ?: return false
    if (path.contains("/auth/callback") || path.contains("/oauth/callback")) {
        val accessToken = uri.getQueryParameter("accessToken")
        val refreshToken = uri.getQueryParameter("refreshToken")
        if (accessToken != null && refreshToken != null) {
            onTokensReceived(accessToken, refreshToken)
            return true
        }
    }
    return false
}
