package us.openframe.app.data.repository

import us.openframe.app.data.local.TokenManager
import us.openframe.app.data.remote.api.AuthApi
import us.openframe.app.data.remote.dto.DeviceCodePollRequest
import us.openframe.app.data.remote.dto.DeviceCodeRequest
import us.openframe.app.data.remote.dto.GoogleIdTokenRequest
import us.openframe.app.data.remote.dto.LoginRequest
import us.openframe.app.data.remote.dto.SignupRequest
import us.openframe.app.domain.model.User
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val authApi: AuthApi,
    private val tokenManager: TokenManager,
) {
    suspend fun checkServerHealth(serverUrl: String): Boolean {
        return try {
            // Temporarily set the server URL for the health check
            val oldUrl = tokenManager.serverUrl
            tokenManager.serverUrl = serverUrl.trimEnd('/')
            val response = authApi.healthCheck()
            if (!response.isSuccessful) {
                tokenManager.serverUrl = oldUrl
                false
            } else {
                true
            }
        } catch (e: Exception) {
            false
        }
    }

    suspend fun signup(name: String, email: String, password: String): Result<User> {
        return try {
            val response = authApi.signup(SignupRequest(email, name, password))
            if (response.isSuccessful) {
                val data = response.body()?.data ?: return Result.failure(Exception("No data"))
                tokenManager.saveTokens(data.accessToken, data.refreshToken)
                Result.success(
                    User(
                        id = data.user.id,
                        email = data.user.email,
                        name = data.user.name,
                        avatarUrl = null,
                        role = null,
                        timezone = null,
                    )
                )
            } else {
                val errorBody = response.errorBody()?.string()
                val message = if (errorBody?.contains("email_taken") == true) {
                    "An account with this email already exists"
                } else {
                    errorBody ?: "Sign up failed"
                }
                Result.failure(Exception(message))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun loginWithGoogleIdToken(idToken: String): Result<User> {
        return try {
            val response = authApi.googleIdToken(GoogleIdTokenRequest(idToken))
            if (response.isSuccessful) {
                val data = response.body()?.data ?: return Result.failure(Exception("No data"))
                tokenManager.saveTokens(data.accessToken, data.refreshToken)
                Result.success(
                    User(
                        id = data.user.id,
                        email = data.user.email,
                        name = data.user.name,
                        avatarUrl = data.user.avatarUrl,
                        role = data.user.role,
                        timezone = data.user.timezone,
                    )
                )
            } else {
                val errorBody = response.errorBody()?.string()
                Result.failure(Exception(errorBody ?: "Google sign-in failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Fetches the server's Google client ID for use with Credential Manager.
     */
    suspend fun getGoogleClientId(): String? {
        return try {
            val response = authApi.getAuthConfig()
            response.body()?.data?.google?.clientId
        } catch (e: Exception) {
            null
        }
    }

    suspend fun login(email: String, password: String): Result<User> {
        return try {
            val response = authApi.login(LoginRequest(email, password))
            if (response.isSuccessful) {
                val data = response.body()?.data ?: return Result.failure(Exception("No data"))
                tokenManager.saveTokens(data.accessToken, data.refreshToken)
                val user = User(
                    id = data.user.id,
                    email = data.user.email,
                    name = data.user.name,
                    avatarUrl = data.user.avatarUrl,
                    role = data.user.role,
                    timezone = data.user.timezone,
                )
                Result.success(user)
            } else {
                val errorBody = response.errorBody()?.string()
                Result.failure(Exception(errorBody ?: "Login failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun loginWithApiKey(apiKey: String): Result<User> {
        return try {
            tokenManager.saveApiKey(apiKey)
            val response = authApi.getCurrentUser()
            if (response.isSuccessful) {
                val data = response.body()?.data ?: return Result.failure(Exception("No data"))
                Result.success(
                    User(
                        id = data.id,
                        email = data.email,
                        name = data.name,
                        avatarUrl = data.avatarUrl,
                        role = data.role,
                        timezone = data.timezone,
                    )
                )
            } else {
                tokenManager.clearAll()
                Result.failure(Exception("Invalid API key"))
            }
        } catch (e: Exception) {
            tokenManager.clearAll()
            Result.failure(e)
        }
    }

    suspend fun getCurrentUser(): Result<User> {
        return try {
            val response = authApi.getCurrentUser()
            if (response.isSuccessful) {
                val data = response.body()?.data ?: return Result.failure(Exception("No data"))
                Result.success(
                    User(
                        id = data.id,
                        email = data.email,
                        name = data.name,
                        avatarUrl = data.avatarUrl,
                        role = data.role,
                        timezone = data.timezone,
                    )
                )
            } else {
                Result.failure(Exception("Failed to get user"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createDeviceCode(): Result<DeviceCodeInfo> {
        return try {
            val response = authApi.createDeviceCode(DeviceCodeRequest())
            if (response.isSuccessful) {
                val data = response.body()?.data ?: return Result.failure(Exception("No data"))
                Result.success(
                    DeviceCodeInfo(
                        deviceCode = data.deviceCode,
                        userCode = data.userCode,
                        verificationUrl = data.verificationUrl,
                        expiresIn = data.expiresIn,
                    )
                )
            } else {
                Result.failure(Exception("Failed to create device code"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun pollDeviceCode(deviceCode: String): Result<DeviceCodeStatus> {
        return try {
            val response = authApi.pollDeviceCode(DeviceCodePollRequest(deviceCode))
            if (response.isSuccessful) {
                val data = response.body()?.data ?: return Result.failure(Exception("No data"))
                when (data.status) {
                    "approved" -> {
                        if (data.accessToken != null && data.refreshToken != null) {
                            tokenManager.saveTokens(data.accessToken, data.refreshToken)
                        }
                        Result.success(DeviceCodeStatus.APPROVED)
                    }
                    "expired" -> Result.success(DeviceCodeStatus.EXPIRED)
                    "denied" -> Result.success(DeviceCodeStatus.DENIED)
                    else -> Result.success(DeviceCodeStatus.PENDING)
                }
            } else {
                Result.failure(Exception("Poll failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun logout() {
        tokenManager.clearAll()
    }

    fun getOAuthUrl(provider: String): String {
        val serverUrl = tokenManager.serverUrl ?: ""
        return "$serverUrl/api/v1/auth/oauth/$provider"
    }
}

data class DeviceCodeInfo(
    val deviceCode: String,
    val userCode: String,
    val verificationUrl: String,
    val expiresIn: Int,
)

enum class DeviceCodeStatus {
    PENDING, APPROVED, EXPIRED, DENIED
}
