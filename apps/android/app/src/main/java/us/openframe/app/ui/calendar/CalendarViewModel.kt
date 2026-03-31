package us.openframe.app.ui.calendar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import us.openframe.app.data.repository.EventRepository
import us.openframe.app.domain.model.CalendarEvent
import us.openframe.app.util.toLocalDate
import us.openframe.app.util.toStartOfDayIso
import java.time.LocalDate
import java.time.YearMonth
import javax.inject.Inject

sealed interface CalendarUiState {
    data object Loading : CalendarUiState
    data class Success(val dayEvents: List<CalendarEvent>) : CalendarUiState
    data class Error(val message: String) : CalendarUiState
}

@HiltViewModel
class CalendarViewModel @Inject constructor(
    private val eventRepository: EventRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow<CalendarUiState>(CalendarUiState.Loading)
    val uiState: StateFlow<CalendarUiState> = _uiState.asStateFlow()

    private val _selectedDate = MutableStateFlow(LocalDate.now())
    val selectedDate: StateFlow<LocalDate> = _selectedDate.asStateFlow()

    private val _currentMonth = MutableStateFlow(YearMonth.now())
    val currentMonth: StateFlow<YearMonth> = _currentMonth.asStateFlow()

    private var allMonthEvents: List<CalendarEvent> = emptyList()

    init {
        loadMonthEvents()
    }

    fun selectDate(date: LocalDate) {
        _selectedDate.value = date
        filterEventsForDay()
    }

    fun previousMonth() {
        _currentMonth.value = _currentMonth.value.minusMonths(1)
        _selectedDate.value = _currentMonth.value.atDay(1)
        loadMonthEvents()
    }

    fun nextMonth() {
        _currentMonth.value = _currentMonth.value.plusMonths(1)
        _selectedDate.value = _currentMonth.value.atDay(1)
        loadMonthEvents()
    }

    fun refresh() = loadMonthEvents()

    private fun loadMonthEvents() {
        viewModelScope.launch {
            _uiState.value = CalendarUiState.Loading
            val month = _currentMonth.value
            val start = month.atDay(1).toStartOfDayIso()
            val end = month.atEndOfMonth().plusDays(1).toStartOfDayIso()

            val result = eventRepository.getEvents(start, end)
            result.fold(
                onSuccess = { events ->
                    allMonthEvents = events.sortedBy { it.startTime }
                    filterEventsForDay()
                },
                onFailure = {
                    _uiState.value = CalendarUiState.Error(it.message ?: "Failed to load")
                },
            )
        }
    }

    private fun filterEventsForDay() {
        val date = _selectedDate.value
        val dayEvents = allMonthEvents.filter {
            try { it.startTime.toLocalDate() == date } catch (e: Exception) { false }
        }
        _uiState.value = CalendarUiState.Success(dayEvents)
    }
}
