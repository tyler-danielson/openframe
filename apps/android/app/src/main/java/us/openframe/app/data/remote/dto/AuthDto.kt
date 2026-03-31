package us.openframe.app.data.remote.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class ApiWrapper<T>(
    @Json(name = "data") val data: T? = null,
    @Json(name = "success") val success: Boolean? = null,
    @Json(name = "error") val error: ApiErrorDto? = null,
    @Json(name = "message") val message: String? = null,
)

@JsonClass(generateAdapter = true)
data class ApiErrorDto(
    @Json(name = "code") val code: String? = null,
    @Json(name = "message") val message: String? = null,
)

// ── Auth DTOs ────────────────────────────────────────────

@JsonClass(generateAdapter = true)
data class LoginRequest(
    @Json(name = "email") val email: String,
    @Json(name = "password") val password: String,
)

@JsonClass(generateAdapter = true)
data class LoginResponse(
    @Json(name = "user") val user: UserDto,
    @Json(name = "accessToken") val accessToken: String,
    @Json(name = "refreshToken") val refreshToken: String,
)

@JsonClass(generateAdapter = true)
data class SignupRequest(
    @Json(name = "email") val email: String,
    @Json(name = "name") val name: String,
    @Json(name = "password") val password: String,
)

@JsonClass(generateAdapter = true)
data class SignupResponse(
    @Json(name = "user") val user: UserDto,
    @Json(name = "accessToken") val accessToken: String,
    @Json(name = "refreshToken") val refreshToken: String,
)

@JsonClass(generateAdapter = true)
data class GoogleIdTokenRequest(
    @Json(name = "idToken") val idToken: String,
)

@JsonClass(generateAdapter = true)
data class GoogleIdTokenResponse(
    @Json(name = "user") val user: UserDto,
    @Json(name = "accessToken") val accessToken: String,
    @Json(name = "refreshToken") val refreshToken: String,
)

@JsonClass(generateAdapter = true)
data class AuthConfigDto(
    @Json(name = "google") val google: GoogleConfigDto? = null,
    @Json(name = "microsoft") val microsoft: MicrosoftConfigDto? = null,
    @Json(name = "emailPassword") val emailPassword: Boolean = true,
    @Json(name = "signup") val signup: Boolean = true,
)

@JsonClass(generateAdapter = true)
data class GoogleConfigDto(
    @Json(name = "clientId") val clientId: String,
)

@JsonClass(generateAdapter = true)
data class MicrosoftConfigDto(
    @Json(name = "available") val available: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class RefreshRequest(
    @Json(name = "refreshToken") val refreshToken: String,
)

@JsonClass(generateAdapter = true)
data class RefreshResponse(
    @Json(name = "accessToken") val accessToken: String,
    @Json(name = "refreshToken") val refreshToken: String,
)

@JsonClass(generateAdapter = true)
data class UserDto(
    @Json(name = "id") val id: String,
    @Json(name = "email") val email: String,
    @Json(name = "name") val name: String? = null,
    @Json(name = "avatarUrl") val avatarUrl: String? = null,
    @Json(name = "role") val role: String? = null,
    @Json(name = "timezone") val timezone: String? = null,
)

@JsonClass(generateAdapter = true)
data class DeviceCodeRequest(
    @Json(name = "placeholder") val placeholder: String? = null,
)

@JsonClass(generateAdapter = true)
data class DeviceCodeResponse(
    @Json(name = "deviceCode") val deviceCode: String,
    @Json(name = "userCode") val userCode: String,
    @Json(name = "verificationUrl") val verificationUrl: String,
    @Json(name = "expiresIn") val expiresIn: Int,
)

@JsonClass(generateAdapter = true)
data class DeviceCodePollRequest(
    @Json(name = "deviceCode") val deviceCode: String,
)

@JsonClass(generateAdapter = true)
data class DeviceCodePollResponse(
    @Json(name = "status") val status: String, // "pending", "approved", "expired", "denied"
    @Json(name = "accessToken") val accessToken: String? = null,
    @Json(name = "refreshToken") val refreshToken: String? = null,
    @Json(name = "user") val user: UserDto? = null,
)
