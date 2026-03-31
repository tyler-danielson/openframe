package us.openframe.app.data.remote.api

import retrofit2.Response
import retrofit2.http.*
import us.openframe.app.data.remote.dto.*

interface TaskApi {

    @GET("/api/v1/tasks/lists")
    suspend fun getTaskLists(): Response<ApiWrapper<List<TaskListDto>>>

    @GET("/api/v1/tasks")
    suspend fun getTasks(
        @Query("listId") listId: String? = null,
        @Query("status") status: String? = null,
    ): Response<ApiWrapper<List<TaskDto>>>

    @POST("/api/v1/tasks")
    suspend fun createTask(@Body request: CreateTaskRequest): Response<ApiWrapper<TaskDto>>

    @POST("/api/v1/tasks/{id}/complete")
    suspend fun completeTask(@Path("id") id: String): Response<ApiWrapper<TaskDto>>

    @DELETE("/api/v1/tasks/{id}")
    suspend fun deleteTask(@Path("id") id: String): Response<Any>
}
