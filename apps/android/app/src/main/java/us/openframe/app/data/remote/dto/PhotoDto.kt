package us.openframe.app.data.remote.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class PhotoAlbumDto(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String? = null,
    @Json(name = "description") val description: String? = null,
    @Json(name = "coverPhotoId") val coverPhotoId: String? = null,
    @Json(name = "coverPhotoPath") val coverPhotoPath: String? = null,
    @Json(name = "photoCount") val photoCount: Int? = null,
    @Json(name = "source") val source: String? = null,
    @Json(name = "sourceType") val sourceType: String? = null,
    @Json(name = "createdAt") val createdAt: String? = null,
    @Json(name = "updatedAt") val updatedAt: String? = null,
    @Json(name = "userId") val userId: String? = null,
)

@JsonClass(generateAdapter = true)
data class PhotoDto(
    @Json(name = "id") val id: String,
    @Json(name = "albumId") val albumId: String? = null,
    @Json(name = "filename") val filename: String? = null,
    @Json(name = "originalFilename") val originalFilename: String? = null,
    @Json(name = "thumbnailPath") val thumbnailPath: String? = null,
    @Json(name = "mediumPath") val mediumPath: String? = null,
    @Json(name = "originalPath") val originalPath: String? = null,
    @Json(name = "thumbnailUrl") val thumbnailUrl: String? = null,
    @Json(name = "mediumUrl") val mediumUrl: String? = null,
    @Json(name = "originalUrl") val originalUrl: String? = null,
    @Json(name = "width") val width: Int? = null,
    @Json(name = "height") val height: Int? = null,
    @Json(name = "size") val size: Int? = null,
    @Json(name = "mimeType") val mimeType: String? = null,
    @Json(name = "metadata") val metadata: Map<String, Any?>? = null,
    @Json(name = "takenAt") val takenAt: String? = null,
    @Json(name = "sortOrder") val sortOrder: Int? = null,
    @Json(name = "sourceType") val sourceType: String? = null,
    @Json(name = "createdAt") val createdAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class CreateAlbumRequest(
    @Json(name = "name") val name: String,
    @Json(name = "description") val description: String? = null,
)
