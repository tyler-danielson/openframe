package us.openframe.app.ui.tasks

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import us.openframe.app.data.repository.TaskRepository
import us.openframe.app.domain.model.Task
import us.openframe.app.domain.model.TaskList
import javax.inject.Inject

sealed interface TasksUiState {
    data object Loading : TasksUiState
    data class Success(val tasks: List<Task>) : TasksUiState
    data class Error(val message: String) : TasksUiState
}

@HiltViewModel
class TasksViewModel @Inject constructor(
    private val taskRepository: TaskRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow<TasksUiState>(TasksUiState.Loading)
    val uiState: StateFlow<TasksUiState> = _uiState.asStateFlow()

    private val _taskLists = MutableStateFlow<List<TaskList>>(emptyList())
    val taskLists: StateFlow<List<TaskList>> = _taskLists.asStateFlow()

    private val _selectedListId = MutableStateFlow<String?>(null)
    val selectedListId: StateFlow<String?> = _selectedListId.asStateFlow()

    private val _showCompleted = MutableStateFlow(false)
    val showCompleted: StateFlow<Boolean> = _showCompleted.asStateFlow()

    init {
        loadTaskLists()
    }

    private fun loadTaskLists() {
        viewModelScope.launch {
            taskRepository.getTaskLists().fold(
                onSuccess = { lists ->
                    _taskLists.value = lists
                    if (_selectedListId.value == null && lists.isNotEmpty()) {
                        _selectedListId.value = lists.first().id
                    }
                    loadTasks()
                },
                onFailure = {
                    _uiState.value = TasksUiState.Error(it.message ?: "Failed to load")
                },
            )
        }
    }

    fun selectList(listId: String) {
        _selectedListId.value = listId
        loadTasks()
    }

    fun toggleShowCompleted() {
        _showCompleted.value = !_showCompleted.value
        loadTasks()
    }

    fun refresh() = loadTasks()

    fun completeTask(taskId: String) {
        viewModelScope.launch {
            taskRepository.completeTask(taskId)
            loadTasks()
        }
    }

    fun createTask(title: String) {
        val listId = _selectedListId.value ?: return
        viewModelScope.launch {
            taskRepository.createTask(listId, title)
            loadTasks()
        }
    }

    private fun loadTasks() {
        viewModelScope.launch {
            _uiState.value = TasksUiState.Loading
            val status = if (_showCompleted.value) null else "needsAction"
            val result = taskRepository.getTasks(
                listId = _selectedListId.value,
                status = status,
            )
            result.fold(
                onSuccess = { tasks ->
                    _uiState.value = TasksUiState.Success(
                        tasks.sortedWith(compareBy<Task> { it.isCompleted }.thenBy { it.title })
                    )
                },
                onFailure = {
                    _uiState.value = TasksUiState.Error(it.message ?: "Failed to load tasks")
                },
            )
        }
    }
}
