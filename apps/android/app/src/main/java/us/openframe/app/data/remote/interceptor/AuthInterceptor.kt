package us.openframe.app.data.remote.interceptor

import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Interceptor
import okhttp3.Response
import us.openframe.app.data.local.TokenManager
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Intercepts all requests to:
 * 1. Rewrite the base URL to the user's configured server
 * 2. Add auth headers (Bearer token or API key)
 */
@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenManager: TokenManager,
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()

        // Rewrite base URL: the Retrofit base is a placeholder,
        // we replace it with the user's actual server URL
        val serverUrl = tokenManager.serverUrl?.replace(Regex("/app/?$"), "")
        val newUrl = if (serverUrl != null) {
            val path = originalRequest.url.encodedPath
            val query = originalRequest.url.encodedQuery
            val fullUrl = buildString {
                append(serverUrl)
                append(path)
                if (!query.isNullOrEmpty()) {
                    append("?")
                    append(query)
                }
            }
            fullUrl.toHttpUrlOrNull() ?: originalRequest.url
        } else {
            originalRequest.url
        }

        val requestBuilder = originalRequest.newBuilder().url(newUrl)

        // Skip auth for login and refresh endpoints
        val path = newUrl.encodedPath
        val skipAuth = path.endsWith("/auth/login") || path.endsWith("/auth/refresh")

        if (!skipAuth) {
            when (tokenManager.authMethod) {
                TokenManager.AuthMethod.BEARER -> {
                    tokenManager.accessToken?.let {
                        requestBuilder.header("Authorization", "Bearer $it")
                    }
                }
                TokenManager.AuthMethod.API_KEY -> {
                    tokenManager.apiKey?.let {
                        requestBuilder.header("X-API-Key", it)
                    }
                }
            }
        }

        return chain.proceed(requestBuilder.build())
    }
}
