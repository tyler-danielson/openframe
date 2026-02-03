import type { FontSizePreset, WidgetStyle } from "../stores/screensaver";

// Legacy font size mapping for backwards compatibility
const LEGACY_FONT_SIZE_MAP: Record<string, FontSizePreset> = {
  small: "sm",
  medium: "md",
  large: "lg",
  xlarge: "xl",
};

/**
 * Normalize font size value, converting legacy values to new preset names
 */
export function normalizeFontSize(fontSize: string | undefined): FontSizePreset {
  if (!fontSize) return "md";
  if (fontSize in LEGACY_FONT_SIZE_MAP) {
    return LEGACY_FONT_SIZE_MAP[fontSize]!;
  }
  return fontSize as FontSizePreset;
}

/**
 * Get font size styles for a widget.
 * Returns either a Tailwind class mapping key or an inline style object for custom sizes.
 */
export function getFontSizeConfig(style: WidgetStyle | undefined): {
  preset: FontSizePreset;
  isCustom: boolean;
  customValue: string | undefined;
} {
  const preset = normalizeFontSize(style?.fontSize);
  const isCustom = preset === "custom";
  const customValue = isCustom ? (style?.customFontSize || "16px") : undefined;

  return { preset, isCustom, customValue };
}

/**
 * Font size scale multipliers for different presets
 * These can be used to calculate proportional sizes for different elements
 */
export const FONT_SIZE_SCALE: Record<Exclude<FontSizePreset, "custom">, number> = {
  xs: 0.5,
  sm: 0.75,
  md: 1,
  lg: 1.5,
  xl: 2,
};

/**
 * Get a Tailwind font size class for a preset, or undefined for custom
 */
export function getTailwindFontSizeClass(preset: FontSizePreset): string {
  const classes: Record<FontSizePreset, string> = {
    xs: "text-xs",
    sm: "text-sm",
    md: "text-lg",
    lg: "text-2xl",
    xl: "text-4xl",
    custom: "",
  };
  return classes[preset];
}
