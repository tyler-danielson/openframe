package us.openframe.app.ui.event

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import us.openframe.app.data.repository.EventRepository
import us.openframe.app.domain.model.CalendarEvent
import javax.inject.Inject

sealed interface EventUiState {
    data object Loading : EventUiState
    data class Success(val event: CalendarEvent) : EventUiState
    data class Error(val message: String) : EventUiState
}

@HiltViewModel
class EventViewModel @Inject constructor(
    private val eventRepository: EventRepository,
) : ViewModel() {

    private val _eventState = MutableStateFlow<EventUiState>(EventUiState.Loading)
    val eventState: StateFlow<EventUiState> = _eventState.asStateFlow()

    private val _isSubmitting = MutableStateFlow(false)
    val isSubmitting: StateFlow<Boolean> = _isSubmitting.asStateFlow()

    fun loadEvent(eventId: String) {
        viewModelScope.launch {
            _eventState.value = EventUiState.Loading
            eventRepository.getEvent(eventId).fold(
                onSuccess = { _eventState.value = EventUiState.Success(it) },
                onFailure = { _eventState.value = EventUiState.Error(it.message ?: "Failed") },
            )
        }
    }

    fun deleteEvent(eventId: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            eventRepository.deleteEvent(eventId).fold(
                onSuccess = { onSuccess() },
                onFailure = { _eventState.value = EventUiState.Error(it.message ?: "Delete failed") },
            )
        }
    }

    fun createQuickEvent(text: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _isSubmitting.value = true
            eventRepository.createQuickEvent(text).fold(
                onSuccess = { _isSubmitting.value = false; onSuccess() },
                onFailure = { _isSubmitting.value = false },
            )
        }
    }
}
