package us.openframe.app.data.remote.api

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import us.openframe.app.data.remote.dto.*

interface AuthApi {

    @POST("/api/v1/auth/signup")
    suspend fun signup(@Body request: SignupRequest): Response<ApiWrapper<SignupResponse>>

    @POST("/api/v1/auth/google-id-token")
    suspend fun googleIdToken(@Body request: GoogleIdTokenRequest): Response<ApiWrapper<GoogleIdTokenResponse>>

    @POST("/api/v1/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<ApiWrapper<LoginResponse>>

    @POST("/api/v1/auth/refresh")
    suspend fun refresh(@Body request: RefreshRequest): Response<ApiWrapper<RefreshResponse>>

    @GET("/api/v1/auth/me")
    suspend fun getCurrentUser(): Response<ApiWrapper<UserDto>>

    @POST("/api/v1/auth/device-codes")
    suspend fun createDeviceCode(@Body request: DeviceCodeRequest): Response<ApiWrapper<DeviceCodeResponse>>

    @POST("/api/v1/auth/device-code/poll")
    suspend fun pollDeviceCode(@Body request: DeviceCodePollRequest): Response<ApiWrapper<DeviceCodePollResponse>>

    @GET("/api/v1/auth/config")
    suspend fun getAuthConfig(): Response<ApiWrapper<AuthConfigDto>>

    @GET("/api/v1/health")
    suspend fun healthCheck(): Response<Any>
}
