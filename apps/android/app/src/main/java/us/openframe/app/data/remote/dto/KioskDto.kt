package us.openframe.app.data.remote.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class KioskDto(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String,
    @Json(name = "isActive") val isActive: Boolean = false,
    @Json(name = "displayMode") val displayMode: String? = null,
    @Json(name = "displayType") val displayType: String? = null,
    @Json(name = "colorScheme") val colorScheme: String? = null,
    @Json(name = "homePage") val homePage: String? = null,
    @Json(name = "screensaverEnabled") val screensaverEnabled: Boolean = false,
    @Json(name = "dashboards") val dashboards: List<KioskDashboardDto>? = null,
    @Json(name = "lastAccessedAt") val lastAccessedAt: String? = null,
    @Json(name = "createdAt") val createdAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class KioskDashboardDto(
    @Json(name = "id") val id: String,
    @Json(name = "type") val type: String,
    @Json(name = "name") val name: String,
    @Json(name = "icon") val icon: String? = null,
    @Json(name = "pinned") val pinned: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class KioskCommandRequest(
    @Json(name = "type") val type: String,
    @Json(name = "payload") val payload: Map<String, Any>? = null,
)

@JsonClass(generateAdapter = true)
data class KioskSavedFileDto(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String,
    @Json(name = "fileType") val fileType: String,
    @Json(name = "mimeType") val mimeType: String? = null,
    @Json(name = "pageCount") val pageCount: Int? = null,
    @Json(name = "fileSize") val fileSize: Int? = null,
    @Json(name = "createdAt") val createdAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class KioskSavedFileUploadResponse(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String,
    @Json(name = "fileType") val fileType: String,
    @Json(name = "mimeType") val mimeType: String? = null,
    @Json(name = "pageCount") val pageCount: Int? = null,
    @Json(name = "fileSize") val fileSize: Int? = null,
)
