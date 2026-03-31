package us.openframe.app.data.remote.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class CalendarDto(
    @Json(name = "id") val id: String,
    @Json(name = "externalId") val externalId: String? = null,
    @Json(name = "provider") val provider: String? = null,
    @Json(name = "name") val name: String,
    @Json(name = "displayName") val displayName: String? = null,
    @Json(name = "color") val color: String? = null,
    @Json(name = "isVisible") val isVisible: Boolean = true,
    @Json(name = "isPrimary") val isPrimary: Boolean = false,
    @Json(name = "isFavorite") val isFavorite: Boolean = false,
    @Json(name = "isReadOnly") val isReadOnly: Boolean = false,
    @Json(name = "syncEnabled") val syncEnabled: Boolean = true,
    @Json(name = "showOnDashboard") val showOnDashboard: Boolean = true,
)

@JsonClass(generateAdapter = true)
data class CalendarEventDto(
    @Json(name = "id") val id: String,
    @Json(name = "calendarId") val calendarId: String,
    @Json(name = "title") val title: String? = null,
    @Json(name = "description") val description: String? = null,
    @Json(name = "location") val location: String? = null,
    @Json(name = "startTime") val startTime: String,
    @Json(name = "endTime") val endTime: String,
    @Json(name = "isAllDay") val isAllDay: Boolean = false,
    @Json(name = "status") val status: String? = null,
    @Json(name = "recurrenceRule") val recurrenceRule: String? = null,
    @Json(name = "calendar") val calendar: CalendarInfoDto? = null,
    @Json(name = "color") val color: String? = null,
)

@JsonClass(generateAdapter = true)
data class CalendarInfoDto(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String,
    @Json(name = "color") val color: String? = null,
)

@JsonClass(generateAdapter = true)
data class CreateEventRequest(
    @Json(name = "calendarId") val calendarId: String,
    @Json(name = "title") val title: String,
    @Json(name = "startTime") val startTime: String,
    @Json(name = "endTime") val endTime: String,
    @Json(name = "description") val description: String? = null,
    @Json(name = "location") val location: String? = null,
    @Json(name = "isAllDay") val isAllDay: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class QuickEventRequest(
    @Json(name = "text") val text: String,
    @Json(name = "calendarId") val calendarId: String? = null,
)

@JsonClass(generateAdapter = true)
data class UpdateEventRequest(
    @Json(name = "title") val title: String? = null,
    @Json(name = "description") val description: String? = null,
    @Json(name = "location") val location: String? = null,
    @Json(name = "startTime") val startTime: String? = null,
    @Json(name = "endTime") val endTime: String? = null,
    @Json(name = "isAllDay") val isAllDay: Boolean? = null,
)

@JsonClass(generateAdapter = true)
data class UpdateCalendarRequest(
    @Json(name = "color") val color: String? = null,
    @Json(name = "isVisible") val isVisible: Boolean? = null,
    @Json(name = "syncEnabled") val syncEnabled: Boolean? = null,
    @Json(name = "isPrimary") val isPrimary: Boolean? = null,
    @Json(name = "isFavorite") val isFavorite: Boolean? = null,
    @Json(name = "showOnDashboard") val showOnDashboard: Boolean? = null,
)
