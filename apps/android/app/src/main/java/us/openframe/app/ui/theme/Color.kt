package us.openframe.app.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * OpenFrame color palettes derived from the web app's CSS HSL variables.
 * Each theme defines a complete dark and light color scheme.
 */

// HSL to Color helper
private fun hsl(h: Float, s: Float, l: Float): Color {
    val sNorm = s / 100f
    val lNorm = l / 100f
    val c = (1f - kotlin.math.abs(2f * lNorm - 1f)) * sNorm
    val x = c * (1f - kotlin.math.abs((h / 60f) % 2f - 1f))
    val m = lNorm - c / 2f
    val (r, g, b) = when {
        h < 60f -> Triple(c, x, 0f)
        h < 120f -> Triple(x, c, 0f)
        h < 180f -> Triple(0f, c, x)
        h < 240f -> Triple(0f, x, c)
        h < 300f -> Triple(x, 0f, c)
        else -> Triple(c, 0f, x)
    }
    return Color(r + m, g + m, b + m)
}

// ═══════════════════════════════════════════════════════════
// Default Blue Theme
// ═══════════════════════════════════════════════════════════
object BlueColors {
    val background = hsl(222.2f, 84f, 4.9f)
    val foreground = hsl(210f, 40f, 98f)
    val card = hsl(222.2f, 84f, 4.9f)
    val cardForeground = hsl(210f, 40f, 98f)
    val primary = hsl(217.2f, 91.2f, 59.8f)
    val primaryForeground = hsl(222.2f, 47.4f, 11.2f)
    val secondary = hsl(217.2f, 32.6f, 17.5f)
    val secondaryForeground = hsl(210f, 40f, 98f)
    val muted = hsl(217.2f, 32.6f, 17.5f)
    val mutedForeground = hsl(215f, 20.2f, 65.1f)
    val accent = hsl(217.2f, 32.6f, 17.5f)
    val accentForeground = hsl(210f, 40f, 98f)
    val destructive = hsl(0f, 62.8f, 30.6f)
    val destructiveForeground = hsl(210f, 40f, 98f)
    val border = hsl(217.2f, 25f, 24f)
    val ring = hsl(224.3f, 76.3f, 48f)
}

// ═══════════════════════════════════════════════════════════
// HOMIO Gold Theme
// ═══════════════════════════════════════════════════════════
object GoldColors {
    val background = hsl(0f, 0f, 4f)
    val foreground = hsl(0f, 0f, 98f)
    val card = hsl(0f, 0f, 6f)
    val cardForeground = hsl(0f, 0f, 98f)
    val primary = hsl(37f, 36f, 63f)
    val primaryForeground = hsl(0f, 0f, 4f)
    val secondary = hsl(0f, 0f, 10f)
    val secondaryForeground = hsl(0f, 0f, 98f)
    val muted = hsl(0f, 0f, 12f)
    val mutedForeground = hsl(0f, 0f, 60f)
    val accent = hsl(0f, 0f, 10f)
    val accentForeground = hsl(0f, 0f, 98f)
    val destructive = hsl(0f, 62.8f, 30.6f)
    val destructiveForeground = hsl(210f, 40f, 98f)
    val border = hsl(0f, 0f, 22f)
    val ring = hsl(37f, 36f, 63f)
}

// ═══════════════════════════════════════════════════════════
// Ocean Teal Theme
// ═══════════════════════════════════════════════════════════
object OceanColors {
    val background = hsl(180f, 20f, 4f)
    val foreground = hsl(180f, 10f, 98f)
    val card = hsl(180f, 15f, 6f)
    val cardForeground = hsl(180f, 10f, 98f)
    val primary = hsl(168f, 76f, 42f)
    val primaryForeground = hsl(180f, 20f, 4f)
    val secondary = hsl(180f, 15f, 12f)
    val secondaryForeground = hsl(180f, 10f, 98f)
    val muted = hsl(180f, 15f, 14f)
    val mutedForeground = hsl(180f, 10f, 60f)
    val accent = hsl(180f, 15f, 12f)
    val accentForeground = hsl(180f, 10f, 98f)
    val destructive = hsl(0f, 62.8f, 30.6f)
    val destructiveForeground = hsl(210f, 40f, 98f)
    val border = hsl(180f, 12f, 24f)
    val ring = hsl(168f, 76f, 42f)
}

// ═══════════════════════════════════════════════════════════
// Forest Green Theme
// ═══════════════════════════════════════════════════════════
object ForestColors {
    val background = hsl(140f, 20f, 4f)
    val foreground = hsl(140f, 10f, 98f)
    val card = hsl(140f, 15f, 6f)
    val cardForeground = hsl(140f, 10f, 98f)
    val primary = hsl(142f, 71f, 45f)
    val primaryForeground = hsl(140f, 20f, 4f)
    val secondary = hsl(140f, 15f, 12f)
    val secondaryForeground = hsl(140f, 10f, 98f)
    val muted = hsl(140f, 15f, 14f)
    val mutedForeground = hsl(140f, 10f, 60f)
    val accent = hsl(140f, 15f, 12f)
    val accentForeground = hsl(140f, 10f, 98f)
    val destructive = hsl(0f, 62.8f, 30.6f)
    val destructiveForeground = hsl(210f, 40f, 98f)
    val border = hsl(140f, 12f, 24f)
    val ring = hsl(142f, 71f, 45f)
}

// ═══════════════════════════════════════════════════════════
// Sunset Orange Theme
// ═══════════════════════════════════════════════════════════
object SunsetColors {
    val background = hsl(20f, 20f, 4f)
    val foreground = hsl(20f, 10f, 98f)
    val card = hsl(20f, 15f, 6f)
    val cardForeground = hsl(20f, 10f, 98f)
    val primary = hsl(25f, 95f, 53f)
    val primaryForeground = hsl(20f, 20f, 4f)
    val secondary = hsl(20f, 15f, 12f)
    val secondaryForeground = hsl(20f, 10f, 98f)
    val muted = hsl(20f, 15f, 14f)
    val mutedForeground = hsl(20f, 10f, 60f)
    val accent = hsl(20f, 15f, 12f)
    val accentForeground = hsl(20f, 10f, 98f)
    val destructive = hsl(0f, 62.8f, 30.6f)
    val destructiveForeground = hsl(210f, 40f, 98f)
    val border = hsl(20f, 12f, 24f)
    val ring = hsl(25f, 95f, 53f)
}

// ═══════════════════════════════════════════════════════════
// Lavender Purple Theme
// ═══════════════════════════════════════════════════════════
object LavenderColors {
    val background = hsl(270f, 20f, 4f)
    val foreground = hsl(270f, 10f, 98f)
    val card = hsl(270f, 15f, 6f)
    val cardForeground = hsl(270f, 10f, 98f)
    val primary = hsl(271f, 91f, 65f)
    val primaryForeground = hsl(270f, 20f, 4f)
    val secondary = hsl(270f, 15f, 12f)
    val secondaryForeground = hsl(270f, 10f, 98f)
    val muted = hsl(270f, 15f, 14f)
    val mutedForeground = hsl(270f, 10f, 60f)
    val accent = hsl(270f, 15f, 12f)
    val accentForeground = hsl(270f, 10f, 98f)
    val destructive = hsl(0f, 62.8f, 30.6f)
    val destructiveForeground = hsl(210f, 40f, 98f)
    val border = hsl(270f, 12f, 24f)
    val ring = hsl(271f, 91f, 65f)
}

// ═══════════════════════════════════════════════════════════
// Light Theme (shared across all schemes)
// ═══════════════════════════════════════════════════════════
object LightColors {
    val background = Color.White
    val foreground = hsl(222.2f, 84f, 4.9f)
    val card = Color.White
    val cardForeground = hsl(222.2f, 84f, 4.9f)
    val primary = hsl(221.2f, 83.2f, 53.3f)
    val primaryForeground = hsl(210f, 40f, 98f)
    val secondary = hsl(210f, 40f, 96.1f)
    val secondaryForeground = hsl(222.2f, 47.4f, 11.2f)
    val muted = hsl(210f, 40f, 96.1f)
    val mutedForeground = hsl(215.4f, 16.3f, 46.9f)
    val accent = hsl(210f, 40f, 96.1f)
    val accentForeground = hsl(222.2f, 47.4f, 11.2f)
    val destructive = hsl(0f, 84.2f, 60.2f)
    val destructiveForeground = hsl(210f, 40f, 98f)
    val border = hsl(214.3f, 31.8f, 91.4f)
    val ring = hsl(221.2f, 83.2f, 53.3f)
}

/**
 * Enum representing the 6 OpenFrame color schemes.
 */
enum class OpenFrameColorScheme(
    val key: String,
    val label: String,
    val accentHex: Long,
) {
    DEFAULT("default", "Blue", 0xFF3B82F6),
    HOMIO("homio", "Gold", 0xFFC4A77D),
    OCEAN("ocean", "Teal", 0xFF14B8A6),
    FOREST("forest", "Green", 0xFF22C55E),
    SUNSET("sunset", "Orange", 0xFFF97316),
    LAVENDER("lavender", "Purple", 0xFFA855F7);

    val accentColor: Color get() = Color(accentHex)

    companion object {
        fun fromKey(key: String): OpenFrameColorScheme =
            entries.find { it.key == key } ?: DEFAULT
    }
}
