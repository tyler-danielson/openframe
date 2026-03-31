package us.openframe.app.data.remote.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class FileShareUploadResponse(
    @Json(name = "shareId") val shareId: String,
    @Json(name = "fileType") val fileType: String,
    @Json(name = "pageCount") val pageCount: Int? = null,
    @Json(name = "mimeType") val mimeType: String? = null,
    @Json(name = "originalName") val originalName: String? = null,
)
