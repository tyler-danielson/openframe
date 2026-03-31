package us.openframe.app.ui.tasks

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import us.openframe.app.ui.components.EmptyState
import us.openframe.app.ui.components.ErrorState
import us.openframe.app.ui.components.LoadingState
import us.openframe.app.ui.components.TaskRow

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TasksScreen(
    viewModel: TasksViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val taskLists by viewModel.taskLists.collectAsState()
    val selectedListId by viewModel.selectedListId.collectAsState()
    val showCompleted by viewModel.showCompleted.collectAsState()
    var showAddDialog by remember { mutableStateOf(false) }
    var newTaskTitle by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Tasks") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
                actions = {
                    TextButton(onClick = { viewModel.toggleShowCompleted() }) {
                        Text(
                            if (showCompleted) "Hide Done" else "Show Done",
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                },
            )
        },
        floatingActionButton = {
            if (selectedListId != null) {
                FloatingActionButton(
                    onClick = { showAddDialog = true },
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ) {
                    Icon(Icons.Default.Add, "Add task")
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            // Task list selector chips
            if (taskLists.isNotEmpty()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    taskLists.forEach { list ->
                        FilterChip(
                            selected = list.id == selectedListId,
                            onClick = { viewModel.selectList(list.id) },
                            label = { Text(list.name, style = MaterialTheme.typography.labelSmall) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f),
                                selectedLabelColor = MaterialTheme.colorScheme.primary,
                            ),
                        )
                    }
                }
            }

            when (val state = uiState) {
                is TasksUiState.Loading -> LoadingState()
                is TasksUiState.Error -> ErrorState(state.message, onRetry = viewModel::refresh)
                is TasksUiState.Success -> {
                    if (state.tasks.isEmpty()) {
                        EmptyState(
                            icon = Icons.Outlined.CheckCircle,
                            title = "No tasks",
                            subtitle = if (showCompleted) "All clear!" else "Tap + to add one",
                        )
                    } else {
                        LazyColumn {
                            items(state.tasks, key = { it.id }) { task ->
                                TaskRow(
                                    task = task,
                                    onToggleComplete = { viewModel.completeTask(task.id) },
                                )
                                HorizontalDivider(
                                    color = MaterialTheme.colorScheme.outline.copy(alpha = 0.15f),
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // Quick add dialog
    if (showAddDialog) {
        AlertDialog(
            onDismissRequest = { showAddDialog = false; newTaskTitle = "" },
            title = { Text("New Task") },
            text = {
                OutlinedTextField(
                    value = newTaskTitle,
                    onValueChange = { newTaskTitle = it },
                    placeholder = { Text("Task title") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (newTaskTitle.isNotBlank()) {
                            viewModel.createTask(newTaskTitle)
                            newTaskTitle = ""
                            showAddDialog = false
                        }
                    },
                ) {
                    Text("Add", color = MaterialTheme.colorScheme.primary)
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddDialog = false; newTaskTitle = "" }) {
                    Text("Cancel")
                }
            },
        )
    }
}
