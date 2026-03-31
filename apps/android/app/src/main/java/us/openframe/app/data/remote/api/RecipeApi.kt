package us.openframe.app.data.remote.api

import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.*
import us.openframe.app.data.remote.dto.*

interface RecipeApi {

    @GET("/api/v1/recipes")
    suspend fun getRecipes(
        @Query("favorite") favorite: Boolean? = null,
        @Query("tag") tag: String? = null,
    ): Response<ApiWrapper<List<RecipeDto>>>

    @GET("/api/v1/recipes/tags")
    suspend fun getTags(): Response<ApiWrapper<List<String>>>

    @GET("/api/v1/recipes/{id}")
    suspend fun getRecipe(@Path("id") id: String): Response<ApiWrapper<RecipeDto>>

    @POST("/api/v1/recipes")
    suspend fun createRecipe(@Body request: CreateRecipeRequest): Response<ApiWrapper<RecipeDto>>

    @PATCH("/api/v1/recipes/{id}")
    suspend fun updateRecipe(
        @Path("id") id: String,
        @Body request: CreateRecipeRequest,
    ): Response<ApiWrapper<RecipeDto>>

    @DELETE("/api/v1/recipes/{id}")
    suspend fun deleteRecipe(@Path("id") id: String): Response<Any>

    @POST("/api/v1/recipes/{id}/favorite")
    suspend fun toggleFavorite(@Path("id") id: String): Response<ApiWrapper<RecipeDto>>

    @POST("/api/v1/recipes/upload-token")
    suspend fun createUploadToken(): Response<ApiWrapper<UploadTokenResponse>>

    @Multipart
    @POST("/api/v1/recipes/upload/{token}")
    suspend fun uploadRecipeImage(
        @Path("token") token: String,
        @Part file: MultipartBody.Part,
    ): Response<ApiWrapper<RecipeDto>>
}
