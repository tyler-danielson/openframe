package us.openframe.app.data.remote.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class RecipeDto(
    @Json(name = "id") val id: String,
    @Json(name = "title") val title: String,
    @Json(name = "description") val description: String? = null,
    @Json(name = "servings") val servings: Int? = null,
    @Json(name = "prepTime") val prepTime: Int? = null,
    @Json(name = "cookTime") val cookTime: Int? = null,
    @Json(name = "ingredients") val ingredients: List<RecipeIngredientDto> = emptyList(),
    @Json(name = "instructions") val instructions: List<String> = emptyList(),
    @Json(name = "tags") val tags: List<String> = emptyList(),
    @Json(name = "notes") val notes: String? = null,
    @Json(name = "sourceImagePath") val sourceImagePath: String? = null,
    @Json(name = "thumbnailPath") val thumbnailPath: String? = null,
    @Json(name = "isFavorite") val isFavorite: Boolean = false,
    @Json(name = "createdAt") val createdAt: String? = null,
    @Json(name = "updatedAt") val updatedAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class RecipeIngredientDto(
    @Json(name = "name") val name: String,
    @Json(name = "amount") val amount: String = "",
    @Json(name = "unit") val unit: String = "",
)

@JsonClass(generateAdapter = true)
data class CreateRecipeRequest(
    @Json(name = "title") val title: String,
    @Json(name = "description") val description: String? = null,
    @Json(name = "servings") val servings: Int? = null,
    @Json(name = "prepTime") val prepTime: Int? = null,
    @Json(name = "cookTime") val cookTime: Int? = null,
    @Json(name = "ingredients") val ingredients: List<RecipeIngredientDto> = emptyList(),
    @Json(name = "instructions") val instructions: List<String> = emptyList(),
    @Json(name = "tags") val tags: List<String> = emptyList(),
    @Json(name = "notes") val notes: String? = null,
)

@JsonClass(generateAdapter = true)
data class UploadTokenResponse(
    @Json(name = "token") val token: String,
    @Json(name = "expiresAt") val expiresAt: String,
)
