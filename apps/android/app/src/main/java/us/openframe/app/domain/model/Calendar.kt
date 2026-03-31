package us.openframe.app.domain.model

data class Calendar(
    val id: String,
    val provider: String?,
    val name: String,
    val displayName: String?,
    val color: String?,
    val isVisible: Boolean,
    val isPrimary: Boolean,
    val isFavorite: Boolean,
    val isReadOnly: Boolean,
    val syncEnabled: Boolean,
) {
    val effectiveName: String get() = displayName ?: name
}

data class CalendarEvent(
    val id: String,
    val calendarId: String,
    val title: String?,
    val description: String?,
    val location: String?,
    val startTime: String,
    val endTime: String,
    val isAllDay: Boolean,
    val status: String?,
    val recurrenceRule: String?,
    val calendarName: String?,
    val calendarColor: String?,
    val color: String?,
) {
    val effectiveColor: String? get() = color ?: calendarColor
}
