package us.openframe.app.ui.today

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.EventNote
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import us.openframe.app.ui.components.EmptyState
import us.openframe.app.ui.components.ErrorState
import us.openframe.app.ui.components.EventCard
import us.openframe.app.ui.components.LoadingState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodayScreen(
    onEventClick: (String) -> Unit,
    onAddEvent: () -> Unit,
    viewModel: TodayViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Today") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground,
                ),
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onAddEvent,
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ) {
                Icon(Icons.Default.Add, "Add event")
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        when (val state = uiState) {
            is TodayUiState.Loading -> LoadingState(Modifier.padding(padding))
            is TodayUiState.Error -> ErrorState(
                message = state.message,
                onRetry = viewModel::refresh,
                modifier = Modifier.padding(padding),
            )
            is TodayUiState.Success -> {
                if (state.groupedEvents.isEmpty()) {
                    EmptyState(
                        icon = Icons.Outlined.EventNote,
                        title = "No upcoming events",
                        subtitle = "Tap + to create one",
                        modifier = Modifier.padding(padding),
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.padding(padding),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        state.groupedEvents.forEach { (dateLabel, events) ->
                            item(key = "header_$dateLabel") {
                                Text(
                                    text = dateLabel,
                                    style = MaterialTheme.typography.titleSmall,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.padding(vertical = 8.dp),
                                )
                            }
                            items(events, key = { it.id }) { event ->
                                EventCard(
                                    event = event,
                                    onClick = { onEventClick(event.id) },
                                    modifier = Modifier.padding(vertical = 2.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
