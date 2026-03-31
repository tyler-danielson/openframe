package us.openframe.app.data.repository

import us.openframe.app.data.remote.api.TaskApi
import us.openframe.app.data.remote.dto.CreateTaskRequest
import us.openframe.app.data.remote.dto.TaskDto
import us.openframe.app.data.remote.dto.TaskListDto
import us.openframe.app.domain.model.Task
import us.openframe.app.domain.model.TaskList
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TaskRepository @Inject constructor(
    private val taskApi: TaskApi,
) {
    suspend fun getTaskLists(): Result<List<TaskList>> {
        return try {
            val response = taskApi.getTaskLists()
            if (response.isSuccessful) {
                val lists = (response.body()?.data ?: emptyList()).map { it.toDomain() }
                Result.success(lists)
            } else {
                Result.failure(Exception("Failed to fetch task lists"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getTasks(listId: String? = null, status: String? = null): Result<List<Task>> {
        return try {
            val response = taskApi.getTasks(listId, status)
            if (response.isSuccessful) {
                val tasks = (response.body()?.data ?: emptyList()).map { it.toDomain() }
                Result.success(tasks)
            } else {
                Result.failure(Exception("Failed to fetch tasks"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createTask(taskListId: String, title: String, notes: String? = null): Result<Task> {
        return try {
            val response = taskApi.createTask(CreateTaskRequest(taskListId, title, notes))
            if (response.isSuccessful) {
                val task = response.body()?.data?.toDomain() ?: return Result.failure(Exception("No data"))
                Result.success(task)
            } else {
                Result.failure(Exception("Failed to create task"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun completeTask(id: String): Result<Task> {
        return try {
            val response = taskApi.completeTask(id)
            if (response.isSuccessful) {
                val task = response.body()?.data?.toDomain() ?: return Result.failure(Exception("No data"))
                Result.success(task)
            } else {
                Result.failure(Exception("Failed to complete task"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteTask(id: String): Result<Unit> {
        return try {
            val response = taskApi.deleteTask(id)
            if (response.isSuccessful) Result.success(Unit)
            else Result.failure(Exception("Failed to delete task"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

private fun TaskListDto.toDomain() = TaskList(id = id, name = name, isVisible = isVisible)

private fun TaskDto.toDomain() = Task(
    id = id, taskListId = taskListId, title = title, notes = notes,
    status = status, dueDate = dueDate, completedAt = completedAt, listName = list?.name,
)
