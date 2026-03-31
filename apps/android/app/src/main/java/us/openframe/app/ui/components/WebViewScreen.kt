package us.openframe.app.ui.components

import android.graphics.Bitmap
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import us.openframe.app.data.local.TokenManager

/**
 * Reusable authenticated WebView that loads a path from the OpenFrame web app.
 * Injects the auth token as a cookie so the SPA can authenticate.
 */
@Composable
fun WebViewScreen(
    tokenManager: TokenManager,
    path: String,
    modifier: Modifier = Modifier,
) {
    val serverUrl = tokenManager.serverUrl ?: return
    val fullUrl = "$serverUrl/app/$path"
    var isLoading by remember { mutableStateOf(true) }

    Box(modifier = modifier.fillMaxSize()) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { context ->
                // Set auth cookie before loading
                val cookieManager = CookieManager.getInstance()
                cookieManager.setAcceptCookie(true)

                when (tokenManager.authMethod) {
                    TokenManager.AuthMethod.BEARER -> {
                        tokenManager.accessToken?.let { token ->
                            cookieManager.setCookie(serverUrl, "accessToken=$token; path=/")
                        }
                        tokenManager.refreshToken?.let { token ->
                            cookieManager.setCookie(serverUrl, "refreshToken=$token; path=/")
                        }
                    }
                    TokenManager.AuthMethod.API_KEY -> {
                        tokenManager.apiKey?.let { key ->
                            cookieManager.setCookie(serverUrl, "apiKey=$key; path=/")
                        }
                    }
                }
                cookieManager.flush()

                WebView(context).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.userAgentString = "OpenFrame-Android/1.0"
                    settings.loadWithOverviewMode = true
                    settings.useWideViewPort = true

                    webViewClient = object : WebViewClient() {
                        override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                            isLoading = true
                        }

                        override fun onPageFinished(view: WebView?, url: String?) {
                            isLoading = false
                            // Inject token into localStorage for SPA auth
                            val js = buildString {
                                when (tokenManager.authMethod) {
                                    TokenManager.AuthMethod.BEARER -> {
                                        tokenManager.accessToken?.let {
                                            append("localStorage.setItem('accessToken','$it');")
                                        }
                                        tokenManager.refreshToken?.let {
                                            append("localStorage.setItem('refreshToken','$it');")
                                        }
                                    }
                                    TokenManager.AuthMethod.API_KEY -> {
                                        tokenManager.apiKey?.let {
                                            append("localStorage.setItem('apiKey','$it');")
                                        }
                                    }
                                }
                            }
                            view?.evaluateJavascript(js, null)
                        }

                        override fun shouldOverrideUrlLoading(
                            view: WebView?,
                            request: WebResourceRequest?,
                        ): Boolean = false
                    }

                    loadUrl(fullUrl)
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
