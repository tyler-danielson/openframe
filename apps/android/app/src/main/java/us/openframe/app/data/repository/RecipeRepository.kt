package us.openframe.app.data.repository

import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import us.openframe.app.data.local.TokenManager
import us.openframe.app.data.remote.api.RecipeApi
import us.openframe.app.data.remote.dto.CreateRecipeRequest
import us.openframe.app.data.remote.dto.RecipeDto
import us.openframe.app.data.remote.dto.RecipeIngredientDto
import us.openframe.app.domain.model.Recipe
import us.openframe.app.domain.model.RecipeIngredient
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RecipeRepository @Inject constructor(
    private val recipeApi: RecipeApi,
    private val tokenManager: TokenManager,
) {
    fun getImageUrl(path: String?): String? {
        if (path.isNullOrBlank()) return null
        val serverUrl = (tokenManager.serverUrl ?: return null).replace(Regex("/app/?$"), "")
        val fullPath = if (path.startsWith("/")) path else "/api/v1/recipes/image/$path"
        val separator = if (fullPath.contains("?")) "&" else "?"
        return when (tokenManager.authMethod) {
            TokenManager.AuthMethod.BEARER -> {
                val token = tokenManager.accessToken ?: return "$serverUrl$fullPath"
                "$serverUrl$fullPath${separator}token=$token"
            }
            TokenManager.AuthMethod.API_KEY -> {
                val key = tokenManager.apiKey ?: return "$serverUrl$fullPath"
                "$serverUrl$fullPath${separator}apiKey=$key"
            }
        }
    }
    suspend fun getRecipes(favorite: Boolean? = null, tag: String? = null): Result<List<Recipe>> {
        return try {
            val response = recipeApi.getRecipes(favorite, tag)
            if (response.isSuccessful) {
                val recipes = (response.body()?.data ?: emptyList()).map { it.toDomain() }
                Result.success(recipes)
            } else {
                Result.failure(Exception("HTTP ${response.code()}: Failed to fetch recipes"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getRecipe(id: String): Result<Recipe> {
        return try {
            val response = recipeApi.getRecipe(id)
            if (response.isSuccessful) {
                val recipe = response.body()?.data?.toDomain()
                    ?: return Result.failure(Exception("No data"))
                Result.success(recipe)
            } else {
                Result.failure(Exception("Failed to fetch recipe"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createRecipe(request: CreateRecipeRequest): Result<Recipe> {
        return try {
            val response = recipeApi.createRecipe(request)
            if (response.isSuccessful) {
                val recipe = response.body()?.data?.toDomain()
                    ?: return Result.failure(Exception("No data"))
                Result.success(recipe)
            } else {
                Result.failure(Exception("Failed to create recipe"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteRecipe(id: String): Result<Unit> {
        return try {
            val response = recipeApi.deleteRecipe(id)
            if (response.isSuccessful) Result.success(Unit)
            else Result.failure(Exception("Failed to delete recipe"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun toggleFavorite(id: String): Result<Recipe> {
        return try {
            val response = recipeApi.toggleFavorite(id)
            if (response.isSuccessful) {
                val recipe = response.body()?.data?.toDomain()
                    ?: return Result.failure(Exception("No data"))
                Result.success(recipe)
            } else {
                Result.failure(Exception("Failed to toggle favorite"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getTags(): Result<List<String>> {
        return try {
            val response = recipeApi.getTags()
            if (response.isSuccessful) {
                Result.success(response.body()?.data ?: emptyList())
            } else {
                Result.failure(Exception("Failed to fetch tags"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun uploadRecipeImage(imageFile: File): Result<Recipe> {
        return try {
            // Step 1: Get upload token
            val tokenResponse = recipeApi.createUploadToken()
            if (!tokenResponse.isSuccessful) {
                return Result.failure(Exception("Failed to get upload token"))
            }
            val token = tokenResponse.body()?.data?.token
                ?: return Result.failure(Exception("No token"))

            // Step 2: Upload image with token
            val requestBody = imageFile.asRequestBody("image/jpeg".toMediaTypeOrNull())
            val part = MultipartBody.Part.createFormData("file", imageFile.name, requestBody)
            val uploadResponse = recipeApi.uploadRecipeImage(token, part)
            if (uploadResponse.isSuccessful) {
                val recipe = uploadResponse.body()?.data?.toDomain()
                    ?: return Result.failure(Exception("No recipe data"))
                Result.success(recipe)
            } else {
                val errorBody = uploadResponse.errorBody()?.string() ?: "Upload failed"
                Result.failure(Exception(errorBody))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

private fun RecipeDto.toDomain() = Recipe(
    id = id,
    title = title,
    description = description,
    servings = servings,
    prepTime = prepTime,
    cookTime = cookTime,
    ingredients = ingredients.map { it.toDomain() },
    instructions = instructions,
    tags = tags,
    notes = notes,
    sourceImagePath = sourceImagePath,
    thumbnailPath = thumbnailPath,
    isFavorite = isFavorite,
)

private fun RecipeIngredientDto.toDomain() = RecipeIngredient(
    name = name, amount = amount, unit = unit,
)
