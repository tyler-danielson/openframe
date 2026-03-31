package us.openframe.app.util

import androidx.compose.ui.graphics.Color

/**
 * Parse a hex color string (#RRGGBB or #AARRGGBB) into a Compose Color.
 * Returns null if parsing fails.
 */
fun String?.toComposeColor(): Color? {
    if (this == null) return null
    return try {
        val hex = removePrefix("#")
        val colorLong = when (hex.length) {
            6 -> "FF$hex".toLong(16)
            8 -> hex.toLong(16)
            else -> return null
        }
        Color(colorLong)
    } catch (e: Exception) {
        null
    }
}

/**
 * Parse a relative time string like "2 hours ago" from an ISO timestamp.
 */
fun String?.toRelativeTime(): String {
    if (this == null) return "Never"
    return try {
        val instant = java.time.Instant.parse(this)
        val now = java.time.Instant.now()
        val duration = java.time.Duration.between(instant, now)

        when {
            duration.toMinutes() < 1 -> "Just now"
            duration.toMinutes() < 60 -> "${duration.toMinutes()}m ago"
            duration.toHours() < 24 -> "${duration.toHours()}h ago"
            duration.toDays() < 7 -> "${duration.toDays()}d ago"
            else -> this.toLocalDateTime().formatDate()
        }
    } catch (e: Exception) {
        "Unknown"
    }
}
