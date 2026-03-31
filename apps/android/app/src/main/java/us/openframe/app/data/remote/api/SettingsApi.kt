package us.openframe.app.data.remote.api

import retrofit2.Response
import retrofit2.http.*
import us.openframe.app.data.remote.dto.ApiWrapper

interface SettingsApi {

    @GET("/api/v1/settings/definitions")
    suspend fun getDefinitions(): Response<ApiWrapper<List<SettingCategoryDef>>>

    @GET("/api/v1/settings")
    suspend fun getAllSettings(): Response<ApiWrapper<List<SystemSettingDto>>>

    @GET("/api/v1/settings/category/{category}")
    suspend fun getCategorySettings(@Path("category") category: String): Response<ApiWrapper<List<SystemSettingDto>>>

    @PUT("/api/v1/settings/category/{category}/{key}")
    suspend fun updateSetting(
        @Path("category") category: String,
        @Path("key") key: String,
        @Body body: Map<String, @JvmSuppressWildcards Any?>,
    ): Response<Any>

    // Modules
    @GET("/api/v1/modules")
    suspend fun getModules(): Response<ApiWrapper<List<ModuleDto>>>

    @PUT("/api/v1/modules/{moduleId}")
    suspend fun updateModule(
        @Path("moduleId") moduleId: String,
        @Body body: Map<String, @JvmSuppressWildcards Any?>,
    ): Response<Any>
}

data class SettingCategoryDef(
    val category: String,
    val label: String,
    val description: String? = null,
    val settings: List<SettingDef> = emptyList(),
)

data class SettingDef(
    val key: String,
    val label: String,
    val description: String? = null,
    val isSecret: Boolean = false,
    val placeholder: String? = null,
)

data class SystemSettingDto(
    val id: String? = null,
    val category: String? = null,
    val key: String? = null,
    val value: String? = null,
    val isSecret: Boolean = false,
    val description: String? = null,
)

data class ModuleDto(
    val id: String,
    val name: String,
    val description: String? = null,
    val enabled: Boolean = false,
    val available: Boolean = true,
    val category: String? = null,
    val icon: String? = null,
    val dependencies: List<String>? = null,
)
