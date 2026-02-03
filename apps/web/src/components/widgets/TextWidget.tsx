import type { WidgetStyle, FontSizePreset } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import { cn } from "../../lib/utils";

interface TextWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
}

// Font size presets mapping to Tailwind classes
const FONT_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
  xl: "text-4xl",
};

export function TextWidget({ config, style }: TextWidgetProps) {
  const content = config.content as string ?? "Hello World";
  const textAlign = config.textAlign as "left" | "center" | "right" ?? "center";
  const fontWeight = config.fontWeight as "normal" | "medium" | "bold" ?? "normal";

  const { preset, isCustom, customValue } = getFontSizeConfig(style);
  const fontSizeClass = isCustom ? "" : FONT_SIZE_CLASSES[preset];

  const alignmentClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }[textAlign];

  const weightClass = {
    normal: "font-normal",
    medium: "font-medium",
    bold: "font-bold",
  }[fontWeight];

  return (
    <div
      className={cn(
        "flex h-full items-center justify-center p-4 rounded-lg",
        "bg-black/40 backdrop-blur-sm"
      )}
      style={{ color: style?.textColor || "#ffffff" }}
    >
      <div
        className={cn(fontSizeClass, alignmentClass, weightClass, "w-full whitespace-pre-wrap")}
        style={isCustom ? { fontSize: customValue } : undefined}
      >
        {content}
      </div>
    </div>
  );
}
