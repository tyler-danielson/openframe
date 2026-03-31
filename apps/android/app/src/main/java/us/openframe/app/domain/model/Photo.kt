package us.openframe.app.domain.model

data class PhotoAlbum(
    val id: String,
    val name: String,
    val description: String?,
    val coverPhotoPath: String?,
    val photoCount: Int,
    val source: String?,
)

data class Photo(
    val id: String,
    val albumId: String?,
    val filename: String?,
    val thumbnailPath: String?,
    val mediumPath: String?,
    val originalPath: String?,
    val width: Int?,
    val height: Int?,
)
