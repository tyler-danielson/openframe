package us.openframe.app.data.repository

import us.openframe.app.data.local.TokenManager
import us.openframe.app.data.remote.api.PhotoApi
import us.openframe.app.data.remote.dto.CreateAlbumRequest
import us.openframe.app.data.remote.dto.PhotoAlbumDto
import us.openframe.app.data.remote.dto.PhotoDto
import us.openframe.app.domain.model.Photo
import us.openframe.app.domain.model.PhotoAlbum
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PhotoRepository @Inject constructor(
    private val photoApi: PhotoApi,
    private val tokenManager: TokenManager,
) {
    suspend fun getAlbums(): Result<List<PhotoAlbum>> {
        return try {
            val response = photoApi.getAlbums()
            if (response.isSuccessful) {
                val albums = (response.body()?.data ?: emptyList()).map { it.toDomain() }
                Result.success(albums)
            } else {
                Result.failure(Exception("Failed to fetch albums"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getAlbumPhotos(albumId: String): Result<List<Photo>> {
        return try {
            val response = photoApi.getAlbumPhotos(albumId)
            if (response.isSuccessful) {
                val body = response.body()
                val dtos = body?.data
                if (dtos == null) {
                    // Try to read raw body for debugging
                    android.util.Log.w("PhotoRepo", "Album photos data was null, body: $body")
                    Result.success(emptyList())
                } else {
                    Result.success(dtos.map { it.toDomain() })
                }
            } else {
                val err = response.errorBody()?.string()
                android.util.Log.e("PhotoRepo", "Album photos failed: ${response.code()} $err")
                Result.failure(Exception("Failed to fetch photos: ${response.code()}"))
            }
        } catch (e: Exception) {
            android.util.Log.e("PhotoRepo", "Album photos exception", e)
            Result.failure(e)
        }
    }

    suspend fun createAlbum(name: String, description: String? = null): Result<PhotoAlbum> {
        return try {
            val response = photoApi.createAlbum(CreateAlbumRequest(name, description))
            if (response.isSuccessful) {
                val album = response.body()?.data?.toDomain() ?: return Result.failure(Exception("No data"))
                Result.success(album)
            } else {
                Result.failure(Exception("Failed to create album"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteAlbum(id: String): Result<Unit> {
        return try {
            val response = photoApi.deleteAlbum(id)
            if (response.isSuccessful) Result.success(Unit)
            else Result.failure(Exception("Failed to delete album"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Constructs an authenticated photo URL, matching the Expo app's getPhotoUrl pattern.
     */
    fun getPhotoUrl(path: String?): String? {
        if (path.isNullOrBlank()) return null
        if (path.startsWith("http")) return path

        // Strip any SPA base path (e.g. /app) — API routes are at the domain root
        val serverUrl = (tokenManager.serverUrl ?: return null)
            .replace(Regex("/app/?$"), "")
        val fullPath = if (path.startsWith("/")) path else "/api/v1/photos/files/$path"
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
}

private fun PhotoAlbumDto.toDomain() = PhotoAlbum(
    id = id, name = name ?: "Untitled", description = description,
    coverPhotoPath = coverPhotoPath, photoCount = photoCount ?: 0, source = source,
)

private fun PhotoDto.toDomain() = Photo(
    id = id, albumId = albumId, filename = filename,
    thumbnailPath = thumbnailUrl ?: thumbnailPath,
    mediumPath = mediumUrl ?: mediumPath,
    originalPath = originalUrl ?: originalPath,
    width = width, height = height,
)
