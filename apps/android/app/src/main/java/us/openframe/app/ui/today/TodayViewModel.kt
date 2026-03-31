package us.openframe.app.ui.today

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import us.openframe.app.data.repository.EventRepository
import us.openframe.app.domain.model.CalendarEvent
import us.openframe.app.util.friendlyName
import us.openframe.app.util.toLocalDate
import us.openframe.app.util.toStartOfDayIso
import java.time.LocalDate
import javax.inject.Inject

sealed interface TodayUiState {
    data object Loading : TodayUiState
    data class Success(val groupedEvents: List<Pair<String, List<CalendarEvent>>>) : TodayUiState
    data class Error(val message: String) : TodayUiState
}

@HiltViewModel
class TodayViewModel @Inject constructor(
    private val eventRepository: EventRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow<TodayUiState>(TodayUiState.Loading)
    val uiState: StateFlow<TodayUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = TodayUiState.Loading
            val today = LocalDate.now()
            val endDate = today.plusDays(7)

            val result = eventRepository.getEvents(
                start = today.toStartOfDayIso(),
                end = endDate.toStartOfDayIso(),
            )

            result.fold(
                onSuccess = { events ->
                    val grouped = events
                        .sortedBy { it.startTime }
                        .groupBy { event ->
                            try { event.startTime.toLocalDate() } catch (e: Exception) { today }
                        }
                        .map { (date, dayEvents) -> date.friendlyName() to dayEvents }

                    _uiState.value = TodayUiState.Success(grouped)
                },
                onFailure = {
                    _uiState.value = TodayUiState.Error(it.message ?: "Failed to load events")
                },
            )
        }
    }
}
