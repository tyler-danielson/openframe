package us.openframe.app.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

/**
 * Extended colors that Material 3 doesn't natively provide.
 */
data class ExtendedColors(
    val card: Color,
    val cardForeground: Color,
    val border: Color,
    val ring: Color,
    val mutedForeground: Color,
    val accentForeground: Color,
    val destructiveForeground: Color,
)

val LocalExtendedColors = staticCompositionLocalOf {
    ExtendedColors(
        card = Color.Unspecified,
        cardForeground = Color.Unspecified,
        border = Color.Unspecified,
        ring = Color.Unspecified,
        mutedForeground = Color.Unspecified,
        accentForeground = Color.Unspecified,
        destructiveForeground = Color.Unspecified,
    )
}

private fun darkSchemeForTheme(scheme: OpenFrameColorScheme) = when (scheme) {
    OpenFrameColorScheme.DEFAULT -> darkColorScheme(
        primary = BlueColors.primary,
        onPrimary = BlueColors.primaryForeground,
        secondary = BlueColors.secondary,
        onSecondary = BlueColors.secondaryForeground,
        tertiary = BlueColors.accent,
        onTertiary = BlueColors.accentForeground,
        background = BlueColors.background,
        onBackground = BlueColors.foreground,
        surface = BlueColors.card,
        onSurface = BlueColors.cardForeground,
        surfaceVariant = BlueColors.muted,
        onSurfaceVariant = BlueColors.mutedForeground,
        error = BlueColors.destructive,
        onError = BlueColors.destructiveForeground,
        outline = BlueColors.border,
        outlineVariant = BlueColors.border,
    )
    OpenFrameColorScheme.HOMIO -> darkColorScheme(
        primary = GoldColors.primary,
        onPrimary = GoldColors.primaryForeground,
        secondary = GoldColors.secondary,
        onSecondary = GoldColors.secondaryForeground,
        tertiary = GoldColors.accent,
        onTertiary = GoldColors.accentForeground,
        background = GoldColors.background,
        onBackground = GoldColors.foreground,
        surface = GoldColors.card,
        onSurface = GoldColors.cardForeground,
        surfaceVariant = GoldColors.muted,
        onSurfaceVariant = GoldColors.mutedForeground,
        error = GoldColors.destructive,
        onError = GoldColors.destructiveForeground,
        outline = GoldColors.border,
        outlineVariant = GoldColors.border,
    )
    OpenFrameColorScheme.OCEAN -> darkColorScheme(
        primary = OceanColors.primary,
        onPrimary = OceanColors.primaryForeground,
        secondary = OceanColors.secondary,
        onSecondary = OceanColors.secondaryForeground,
        tertiary = OceanColors.accent,
        onTertiary = OceanColors.accentForeground,
        background = OceanColors.background,
        onBackground = OceanColors.foreground,
        surface = OceanColors.card,
        onSurface = OceanColors.cardForeground,
        surfaceVariant = OceanColors.muted,
        onSurfaceVariant = OceanColors.mutedForeground,
        error = OceanColors.destructive,
        onError = OceanColors.destructiveForeground,
        outline = OceanColors.border,
        outlineVariant = OceanColors.border,
    )
    OpenFrameColorScheme.FOREST -> darkColorScheme(
        primary = ForestColors.primary,
        onPrimary = ForestColors.primaryForeground,
        secondary = ForestColors.secondary,
        onSecondary = ForestColors.secondaryForeground,
        tertiary = ForestColors.accent,
        onTertiary = ForestColors.accentForeground,
        background = ForestColors.background,
        onBackground = ForestColors.foreground,
        surface = ForestColors.card,
        onSurface = ForestColors.cardForeground,
        surfaceVariant = ForestColors.muted,
        onSurfaceVariant = ForestColors.mutedForeground,
        error = ForestColors.destructive,
        onError = ForestColors.destructiveForeground,
        outline = ForestColors.border,
        outlineVariant = ForestColors.border,
    )
    OpenFrameColorScheme.SUNSET -> darkColorScheme(
        primary = SunsetColors.primary,
        onPrimary = SunsetColors.primaryForeground,
        secondary = SunsetColors.secondary,
        onSecondary = SunsetColors.secondaryForeground,
        tertiary = SunsetColors.accent,
        onTertiary = SunsetColors.accentForeground,
        background = SunsetColors.background,
        onBackground = SunsetColors.foreground,
        surface = SunsetColors.card,
        onSurface = SunsetColors.cardForeground,
        surfaceVariant = SunsetColors.muted,
        onSurfaceVariant = SunsetColors.mutedForeground,
        error = SunsetColors.destructive,
        onError = SunsetColors.destructiveForeground,
        outline = SunsetColors.border,
        outlineVariant = SunsetColors.border,
    )
    OpenFrameColorScheme.LAVENDER -> darkColorScheme(
        primary = LavenderColors.primary,
        onPrimary = LavenderColors.primaryForeground,
        secondary = LavenderColors.secondary,
        onSecondary = LavenderColors.secondaryForeground,
        tertiary = LavenderColors.accent,
        onTertiary = LavenderColors.accentForeground,
        background = LavenderColors.background,
        onBackground = LavenderColors.foreground,
        surface = LavenderColors.card,
        onSurface = LavenderColors.cardForeground,
        surfaceVariant = LavenderColors.muted,
        onSurfaceVariant = LavenderColors.mutedForeground,
        error = LavenderColors.destructive,
        onError = LavenderColors.destructiveForeground,
        outline = LavenderColors.border,
        outlineVariant = LavenderColors.border,
    )
}

private fun extendedColorsForTheme(scheme: OpenFrameColorScheme, isDark: Boolean): ExtendedColors {
    if (!isDark) {
        return ExtendedColors(
            card = LightColors.card,
            cardForeground = LightColors.cardForeground,
            border = LightColors.border,
            ring = LightColors.ring,
            mutedForeground = LightColors.mutedForeground,
            accentForeground = LightColors.accentForeground,
            destructiveForeground = LightColors.destructiveForeground,
        )
    }
    return when (scheme) {
        OpenFrameColorScheme.DEFAULT -> ExtendedColors(
            card = BlueColors.card, cardForeground = BlueColors.cardForeground,
            border = BlueColors.border, ring = BlueColors.ring,
            mutedForeground = BlueColors.mutedForeground,
            accentForeground = BlueColors.accentForeground,
            destructiveForeground = BlueColors.destructiveForeground,
        )
        OpenFrameColorScheme.HOMIO -> ExtendedColors(
            card = GoldColors.card, cardForeground = GoldColors.cardForeground,
            border = GoldColors.border, ring = GoldColors.ring,
            mutedForeground = GoldColors.mutedForeground,
            accentForeground = GoldColors.accentForeground,
            destructiveForeground = GoldColors.destructiveForeground,
        )
        OpenFrameColorScheme.OCEAN -> ExtendedColors(
            card = OceanColors.card, cardForeground = OceanColors.cardForeground,
            border = OceanColors.border, ring = OceanColors.ring,
            mutedForeground = OceanColors.mutedForeground,
            accentForeground = OceanColors.accentForeground,
            destructiveForeground = OceanColors.destructiveForeground,
        )
        OpenFrameColorScheme.FOREST -> ExtendedColors(
            card = ForestColors.card, cardForeground = ForestColors.cardForeground,
            border = ForestColors.border, ring = ForestColors.ring,
            mutedForeground = ForestColors.mutedForeground,
            accentForeground = ForestColors.accentForeground,
            destructiveForeground = ForestColors.destructiveForeground,
        )
        OpenFrameColorScheme.SUNSET -> ExtendedColors(
            card = SunsetColors.card, cardForeground = SunsetColors.cardForeground,
            border = SunsetColors.border, ring = SunsetColors.ring,
            mutedForeground = SunsetColors.mutedForeground,
            accentForeground = SunsetColors.accentForeground,
            destructiveForeground = SunsetColors.destructiveForeground,
        )
        OpenFrameColorScheme.LAVENDER -> ExtendedColors(
            card = LavenderColors.card, cardForeground = LavenderColors.cardForeground,
            border = LavenderColors.border, ring = LavenderColors.ring,
            mutedForeground = LavenderColors.mutedForeground,
            accentForeground = LavenderColors.accentForeground,
            destructiveForeground = LavenderColors.destructiveForeground,
        )
    }
}

private val LightColorScheme = lightColorScheme(
    primary = LightColors.primary,
    onPrimary = LightColors.primaryForeground,
    secondary = LightColors.secondary,
    onSecondary = LightColors.secondaryForeground,
    tertiary = LightColors.accent,
    onTertiary = LightColors.accentForeground,
    background = LightColors.background,
    onBackground = LightColors.foreground,
    surface = LightColors.card,
    onSurface = LightColors.cardForeground,
    surfaceVariant = LightColors.muted,
    onSurfaceVariant = LightColors.mutedForeground,
    error = LightColors.destructive,
    onError = LightColors.destructiveForeground,
    outline = LightColors.border,
    outlineVariant = LightColors.border,
)

@Composable
fun OpenFrameTheme(
    colorScheme: OpenFrameColorScheme = OpenFrameColorScheme.DEFAULT,
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val materialColors = if (darkTheme) {
        darkSchemeForTheme(colorScheme)
    } else {
        LightColorScheme
    }

    val extendedColors = extendedColorsForTheme(colorScheme, darkTheme)

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window ?: return@SideEffect
            window.statusBarColor = materialColors.background.toArgb()
            window.navigationBarColor = materialColors.surface.toArgb()
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = !darkTheme
                isAppearanceLightNavigationBars = !darkTheme
            }
        }
    }

    CompositionLocalProvider(LocalExtendedColors provides extendedColors) {
        MaterialTheme(
            colorScheme = materialColors,
            typography = OpenFrameTypography,
            content = content,
        )
    }
}

/**
 * Access extended colors from anywhere in the Compose tree.
 */
object OpenFrameThemeExtras {
    val colors: ExtendedColors
        @Composable
        get() = LocalExtendedColors.current
}
