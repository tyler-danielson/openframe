package us.openframe.app.domain.model

data class TaskList(
    val id: String,
    val name: String,
    val isVisible: Boolean,
)

data class Task(
    val id: String,
    val taskListId: String,
    val title: String,
    val notes: String?,
    val status: String?,
    val dueDate: String?,
    val completedAt: String?,
    val listName: String?,
) {
    val isCompleted: Boolean get() = status == "completed"
}
