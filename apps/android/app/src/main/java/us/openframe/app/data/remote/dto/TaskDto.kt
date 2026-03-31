package us.openframe.app.data.remote.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class TaskListDto(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String,
    @Json(name = "isVisible") val isVisible: Boolean = true,
)

@JsonClass(generateAdapter = true)
data class TaskDto(
    @Json(name = "id") val id: String,
    @Json(name = "taskListId") val taskListId: String,
    @Json(name = "title") val title: String,
    @Json(name = "notes") val notes: String? = null,
    @Json(name = "status") val status: String? = null,
    @Json(name = "dueDate") val dueDate: String? = null,
    @Json(name = "completedAt") val completedAt: String? = null,
    @Json(name = "position") val position: String? = null,
    @Json(name = "list") val list: TaskListInfoDto? = null,
)

@JsonClass(generateAdapter = true)
data class TaskListInfoDto(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String,
)

@JsonClass(generateAdapter = true)
data class CreateTaskRequest(
    @Json(name = "taskListId") val taskListId: String,
    @Json(name = "title") val title: String,
    @Json(name = "notes") val notes: String? = null,
    @Json(name = "dueDate") val dueDate: String? = null,
)
