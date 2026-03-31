package us.openframe.app.util

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

fun String.toLocalDateTime(): LocalDateTime {
    return try {
        val instant = Instant.parse(this)
        instant.atZone(ZoneId.systemDefault()).toLocalDateTime()
    } catch (e: Exception) {
        LocalDateTime.parse(this.take(19))
    }
}

fun String.toLocalDate(): LocalDate {
    return toLocalDateTime().toLocalDate()
}

fun LocalDateTime.toIsoString(): String {
    return atZone(ZoneId.systemDefault()).toInstant().toString()
}

fun LocalDate.toStartOfDayIso(): String {
    return atStartOfDay(ZoneId.systemDefault()).toInstant().toString()
}

fun LocalDate.toEndOfDayIso(): String {
    return atTime(LocalTime.MAX).atZone(ZoneId.systemDefault()).toInstant().toString()
}

fun LocalDateTime.formatTime(): String {
    return format(DateTimeFormatter.ofPattern("h:mm a"))
}

fun LocalDateTime.formatDate(): String {
    return format(DateTimeFormatter.ofPattern("EEE, MMM d"))
}

fun LocalDateTime.formatDateFull(): String {
    return format(DateTimeFormatter.ofPattern("EEEE, MMMM d, yyyy"))
}

fun LocalDateTime.formatDateTime(): String {
    return format(DateTimeFormatter.ofPattern("MMM d, h:mm a"))
}

fun LocalDate.isToday(): Boolean = this == LocalDate.now()
fun LocalDate.isTomorrow(): Boolean = this == LocalDate.now().plusDays(1)

fun LocalDate.friendlyName(): String = when {
    isToday() -> "Today"
    isTomorrow() -> "Tomorrow"
    else -> format(DateTimeFormatter.ofPattern("EEEE, MMM d"))
}

fun LocalDate.dayOfWeekShort(): String {
    return dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.getDefault())
}
