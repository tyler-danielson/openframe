package us.openframe.app.data.remote.interceptor

import com.squareup.moshi.Moshi
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.Authenticator
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route
import us.openframe.app.data.local.TokenManager
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Handles 401 responses by refreshing the access token.
 * Uses a mutex to prevent concurrent refresh races.
 */
@Singleton
class TokenRefreshAuthenticator @Inject constructor(
    private val tokenManager: TokenManager,
    private val moshi: Moshi,
) : Authenticator {

    private val mutex = Mutex()

    override fun authenticate(route: Route?, response: Response): Request? {
        // Only refresh for Bearer auth
        if (tokenManager.authMethod != TokenManager.AuthMethod.BEARER) return null

        // Don't retry if this is already a refresh request
        if (response.request.url.encodedPath.endsWith("/auth/refresh")) return null

        // Don't retry more than twice (original + 1 retry after refresh)
        if (responseCount(response) >= 3) {
            return null
        }

        return runBlocking {
            mutex.withLock {
                // Check if another thread already refreshed while we waited
                val currentToken = tokenManager.accessToken
                val requestToken = response.request.header("Authorization")
                    ?.removePrefix("Bearer ")

                if (currentToken != null && currentToken != requestToken) {
                    // Token was refreshed by another request, retry with new token
                    return@runBlocking response.request.newBuilder()
                        .header("Authorization", "Bearer $currentToken")
                        .build()
                }

                // Perform the refresh
                val refreshed = refreshTokens()
                if (refreshed) {
                    val newToken = tokenManager.accessToken ?: return@runBlocking null
                    response.request.newBuilder()
                        .header("Authorization", "Bearer $newToken")
                        .build()
                } else {
                    // Don't force logout — let the request fail gracefully
                    // so the UI can show an error instead of kicking the user out
                    null
                }
            }
        }
    }

    private fun refreshTokens(): Boolean {
        val serverUrl = (tokenManager.serverUrl ?: return false).replace(Regex("/app/?$"), "")
        val refreshToken = tokenManager.refreshToken ?: return false

        val json = """{"refreshToken":"$refreshToken"}"""
        val body = json.toRequestBody("application/json".toMediaType())

        val request = Request.Builder()
            .url("$serverUrl/api/v1/auth/refresh")
            .post(body)
            .build()

        return try {
            // Use a plain client without the authenticator to avoid loops
            val client = OkHttpClient.Builder().build()
            val response = client.newCall(request).execute()

            if (response.isSuccessful) {
                val responseBody = response.body?.string() ?: return false
                val adapter = moshi.adapter(RefreshResponse::class.java)
                val result = adapter.fromJson(responseBody)
                val data = result?.data ?: return false
                tokenManager.saveTokens(data.accessToken, data.refreshToken)
                true
            } else {
                false
            }
        } catch (e: Exception) {
            false
        }
    }

    private fun forceLogout() {
        tokenManager.clearAll()
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }
}

// Internal DTOs for refresh response parsing
private data class RefreshResponse(val data: RefreshData?)
private data class RefreshData(val accessToken: String, val refreshToken: String)
