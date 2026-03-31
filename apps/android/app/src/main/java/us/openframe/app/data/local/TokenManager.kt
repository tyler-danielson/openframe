package us.openframe.app.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TokenManager @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "openframe_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    private val _isAuthenticated = MutableStateFlow(hasCredentials())
    val isAuthenticated: StateFlow<Boolean> = _isAuthenticated.asStateFlow()

    // ── Server URL ─────────────────────────────────────────

    var serverUrl: String?
        get() = prefs.getString(KEY_SERVER_URL, null)
        set(value) {
            prefs.edit().putString(KEY_SERVER_URL, value?.trimEnd('/')).apply()
        }

    // ── Auth method ────────────────────────────────────────

    enum class AuthMethod { BEARER, API_KEY }

    var authMethod: AuthMethod
        get() = if (prefs.getString(KEY_AUTH_METHOD, "bearer") == "api_key") {
            AuthMethod.API_KEY
        } else {
            AuthMethod.BEARER
        }
        set(value) {
            val str = if (value == AuthMethod.API_KEY) "api_key" else "bearer"
            prefs.edit().putString(KEY_AUTH_METHOD, str).apply()
        }

    // ── Bearer tokens ──────────────────────────────────────

    var accessToken: String?
        get() = prefs.getString(KEY_ACCESS_TOKEN, null)
        set(value) {
            prefs.edit().putString(KEY_ACCESS_TOKEN, value).apply()
            _isAuthenticated.value = hasCredentials()
        }

    var refreshToken: String?
        get() = prefs.getString(KEY_REFRESH_TOKEN, null)
        set(value) {
            prefs.edit().putString(KEY_REFRESH_TOKEN, value).apply()
        }

    // ── API key ────────────────────────────────────────────

    var apiKey: String?
        get() = prefs.getString(KEY_API_KEY, null)
        set(value) {
            prefs.edit().putString(KEY_API_KEY, value).apply()
            _isAuthenticated.value = hasCredentials()
        }

    // ── Helpers ────────────────────────────────────────────

    fun saveTokens(access: String, refresh: String) {
        prefs.edit()
            .putString(KEY_ACCESS_TOKEN, access)
            .putString(KEY_REFRESH_TOKEN, refresh)
            .putString(KEY_AUTH_METHOD, "bearer")
            .apply()
        authMethod = AuthMethod.BEARER
        _isAuthenticated.value = true
    }

    fun saveApiKey(key: String) {
        prefs.edit()
            .putString(KEY_API_KEY, key)
            .putString(KEY_AUTH_METHOD, "api_key")
            .apply()
        authMethod = AuthMethod.API_KEY
        _isAuthenticated.value = true
    }

    fun clearAll() {
        prefs.edit().clear().apply()
        _isAuthenticated.value = false
    }

    fun hasCredentials(): Boolean {
        return when (authMethod) {
            AuthMethod.BEARER -> !accessToken.isNullOrBlank()
            AuthMethod.API_KEY -> !apiKey.isNullOrBlank()
        }
    }

    fun hasServerUrl(): Boolean = !serverUrl.isNullOrBlank()

    companion object {
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_AUTH_METHOD = "auth_method"
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_API_KEY = "api_key"
    }
}
