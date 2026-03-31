package us.openframe.app.ui.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.outlined.EventBusy
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import us.openframe.app.ui.components.EmptyState
import us.openframe.app.ui.components.ErrorState
import us.openframe.app.ui.components.EventCard
import us.openframe.app.ui.components.LoadingState
import us.openframe.app.util.dayOfWeekShort
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendarScreen(
    onEventClick: (String) -> Unit,
    onAddEvent: () -> Unit,
    viewModel: CalendarViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val selectedDate by viewModel.selectedDate.collectAsState()
    val currentMonth by viewModel.currentMonth.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Calendar") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
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
        Column(modifier = Modifier.padding(padding)) {
            // Month header with navigation
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                IconButton(onClick = { viewModel.previousMonth() }) {
                    Icon(Icons.Default.ChevronLeft, "Previous month")
                }
                Text(
                    text = currentMonth.format(DateTimeFormatter.ofPattern("MMMM yyyy")),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onBackground,
                )
                IconButton(onClick = { viewModel.nextMonth() }) {
                    Icon(Icons.Default.ChevronRight, "Next month")
                }
            }

            // Day-of-week headers
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp),
            ) {
                val firstDay = LocalDate.now().with(java.time.DayOfWeek.SUNDAY)
                for (i in 0..6) {
                    Text(
                        text = firstDay.plusDays(i.toLong()).dayOfWeekShort(),
                        modifier = Modifier.weight(1f),
                        textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Calendar grid
            val firstOfMonth = currentMonth.atDay(1)
            val daysInMonth = currentMonth.lengthOfMonth()
            val startOffset = (firstOfMonth.dayOfWeek.value % 7) // Sunday = 0

            Column(modifier = Modifier.padding(horizontal = 8.dp)) {
                var dayCounter = 1
                for (week in 0..5) {
                    if (dayCounter > daysInMonth) break
                    Row(modifier = Modifier.fillMaxWidth()) {
                        for (dow in 0..6) {
                            val cellIndex = week * 7 + dow
                            if (cellIndex < startOffset || dayCounter > daysInMonth) {
                                Spacer(modifier = Modifier.weight(1f))
                            } else {
                                val date = currentMonth.atDay(dayCounter)
                                val isSelected = date == selectedDate
                                val isToday = date == LocalDate.now()

                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .aspectRatio(1f)
                                        .clip(CircleShape)
                                        .then(
                                            if (isSelected) Modifier.background(
                                                MaterialTheme.colorScheme.primary,
                                                CircleShape
                                            )
                                            else if (isToday) Modifier.background(
                                                MaterialTheme.colorScheme.primary.copy(alpha = 0.15f),
                                                CircleShape
                                            )
                                            else Modifier
                                        )
                                        .clickable { viewModel.selectDate(date) },
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Text(
                                        text = dayCounter.toString(),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = if (isSelected) MaterialTheme.colorScheme.onPrimary
                                        else MaterialTheme.colorScheme.onBackground,
                                    )
                                }
                                dayCounter++
                            }
                        }
                    }
                }
            }

            HorizontalDivider(
                modifier = Modifier.padding(vertical = 8.dp),
                color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f),
            )

            // Events for selected date
            when (val state = uiState) {
                is CalendarUiState.Loading -> LoadingState()
                is CalendarUiState.Error -> ErrorState(state.message, onRetry = viewModel::refresh)
                is CalendarUiState.Success -> {
                    if (state.dayEvents.isEmpty()) {
                        EmptyState(
                            icon = Icons.Outlined.EventBusy,
                            title = "No events",
                            subtitle = "Nothing scheduled for this day",
                        )
                    } else {
                        LazyColumn(
                            contentPadding = PaddingValues(horizontal = 16.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            items(state.dayEvents, key = { it.id }) { event ->
                                EventCard(
                                    event = event,
                                    onClick = { onEventClick(event.id) },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
